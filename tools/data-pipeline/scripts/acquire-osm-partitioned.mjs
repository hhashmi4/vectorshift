import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const planPath = resolve(root, process.argv[2] ?? "tools/data-pipeline/config/toronto-downtown-halo-500m-partitions.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const elementOrder = { node: 0, way: 1, relation: 2 };

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
}

function assertBounds(bounds, name) {
  if (!bounds || ![bounds.south, bounds.west, bounds.north, bounds.east].every(Number.isFinite)) throw new Error(`${name} must contain finite bounds`);
  if (bounds.south >= bounds.north || bounds.west >= bounds.east) throw new Error(`${name} bounds must have positive area`);
  if (bounds.south < plan.bounds.south || bounds.north > plan.bounds.north || bounds.west < plan.bounds.west || bounds.east > plan.bounds.east) {
    throw new Error(`${name} exceeds the declared plan bounds`);
  }
}

assertPositiveInteger(plan.query_timeout_seconds, "query_timeout_seconds");
assertPositiveInteger(plan.client_timeout_ms, "client_timeout_ms");
assertPositiveInteger(plan.maximum_partition_bytes, "maximum_partition_bytes");
assertPositiveInteger(plan.maximum_total_bytes, "maximum_total_bytes");
assertBounds(plan.bounds, "plan");
if (!Array.isArray(plan.partitions) || plan.partitions.length < 2 || plan.partitions.length > 16) throw new Error("partitions must contain between 2 and 16 entries");
if (plan.maximum_partition_bytes * plan.partitions.length > plan.maximum_total_bytes) throw new Error("partition caps exceed the total acquisition cap");

function queryFor(partition) {
  const bbox = `${partition.bounds.south},${partition.bounds.west},${partition.bounds.north},${partition.bounds.east}`;
  if (partition.selector === "highway") return `[out:json][timeout:${plan.query_timeout_seconds}][maxsize:67108864][date:"${plan.snapshot_at}"];\nway["highway"](${bbox});\nout body;\n>;\nout skel qt;\n`;
  if (partition.selector === "restriction") return `[out:json][timeout:${plan.query_timeout_seconds}][maxsize:67108864][date:"${plan.snapshot_at}"];\nrelation["type"="restriction"](${bbox});\nout body;\n>;\nout skel qt;\n`;
  throw new Error(`partition ${partition.id} has an unsupported selector`);
}

async function digestFile(path) {
  const bytes = await readFile(path);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function acquire(partition) {
  if (!idPattern.test(partition.id)) throw new Error(`invalid partition id ${partition.id}`);
  assertBounds(partition.bounds, `partition ${partition.id}`);
  const query = queryFor(partition);
  const destination = resolve(root, plan.raw_directory, `${partition.id}.overpass.json`);
  const partial = `${destination}.partial`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    const existing = await digestFile(destination);
    return { ...partition, query, destination, ...existing, status: "verified-existing", acquisition_attempts: 0 };
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }

  await rm(partial, { force: true });
  let response;
  let acquisitionAttempts = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    acquisitionAttempts = attempt;
    try {
      response = await fetch(plan.endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": "VECTORSHIFT/phase-1d bounded-reference-acquisition" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(plan.client_timeout_ms),
      });
      if (response.ok && response.body) break;
      if (![429, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error(`partition ${partition.id} failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000));
  }
  if (response === undefined || !response.ok || !response.body) throw new Error(`partition ${partition.id} did not produce a response`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > plan.maximum_partition_bytes) throw new Error(`partition ${partition.id} declares ${declaredLength} bytes over cap`);

  const handle = await open(partial, "wx");
  const digest = createHash("sha256");
  let byteCount = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > plan.maximum_partition_bytes) {
        await reader.cancel("partition response exceeded byte cap");
        throw new Error(`partition ${partition.id} exceeded ${plan.maximum_partition_bytes} bytes`);
      }
      digest.update(value);
      await handle.write(value);
    }
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(partial, { force: true });
    throw error;
  }
  await handle.close();
  await copyFile(partial, destination, constants.COPYFILE_EXCL);
  await rm(partial, { force: true });
  return { ...partition, query, destination, bytes: await readFile(destination), sha256: digest.digest("hex"), status: "created", acquisition_attempts: acquisitionAttempts };
}

const acquired = [];
let totalBytes = 0;
for (const partition of plan.partitions) {
  const result = await acquire(partition);
  totalBytes += result.bytes.byteLength;
  if (totalBytes > plan.maximum_total_bytes) throw new Error("total partition bytes exceed acquisition cap");
  acquired.push(result);
  console.error(`${partition.id}: ${result.status}, ${result.bytes.byteLength} bytes, ${result.sha256}, attempts ${result.acquisition_attempts}`);
}

const elementByKey = new Map();
let generator = "unknown";
let timestampOsmBase = "unknown";
function mergeCompatibleElements(existing, incoming, key) {
  const merged = { ...existing };
  for (const [property, value] of Object.entries(incoming)) {
    if (!(property in merged)) {
      merged[property] = value;
      continue;
    }
    if (JSON.stringify(merged[property]) !== JSON.stringify(value)) throw new Error(`conflicting duplicate ${key} property ${property} across partitions`);
  }
  return merged;
}
for (const part of acquired) {
  const document = JSON.parse(part.bytes.toString("utf8"));
  if (!Array.isArray(document.elements)) throw new Error(`partition ${part.id} is not an Overpass element document`);
  generator = document.generator ?? generator;
  timestampOsmBase = document.osm3s?.timestamp_osm_base ?? timestampOsmBase;
  for (const element of document.elements) {
    if (!(element.type in elementOrder) || !Number.isSafeInteger(element.id)) throw new Error(`partition ${part.id} contains an invalid element`);
    const key = `${element.type}:${element.id}`;
    const existing = elementByKey.get(key);
    elementByKey.set(key, existing === undefined ? element : mergeCompatibleElements(existing, element, key));
  }
}
const elements = [...elementByKey.values()].sort((left, right) => elementOrder[left.type] - elementOrder[right.type] || left.id - right.id);
const merged = `${JSON.stringify({ version: 0.6, generator: "VECTORSHIFT deterministic Overpass partition merge/1", osm3s: { timestamp_osm_base: timestampOsmBase, source_generator: generator }, elements })}\n`;
const mergedPath = resolve(root, plan.merged_path);
const mergedPartial = `${mergedPath}.partial`;
await mkdir(dirname(mergedPath), { recursive: true });
try {
  const existing = await readFile(mergedPath, "utf8");
  if (existing !== merged) throw new Error(`refusing to overwrite non-matching merged acquisition ${plan.merged_path}`);
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  await rm(mergedPartial, { force: true });
  await writeFile(mergedPartial, merged, { flag: "wx" });
  await copyFile(mergedPartial, mergedPath, constants.COPYFILE_EXCL);
  await rm(mergedPartial, { force: true });
}

const counts = Object.fromEntries(Object.keys(elementOrder).map((type) => [type, elements.filter((element) => element.type === type).length]));
const manifest = {
  manifest_version: 1,
  acquisition_strategy_version: "overpass-bounded-partitions/1",
  area_id: plan.area_id,
  source: "OpenStreetMap contributors via Overpass API",
  source_url: plan.source_url,
  endpoint: plan.endpoint,
  acquired_at: new Date().toISOString(),
  snapshot_at: plan.snapshot_at,
  bounds: plan.bounds,
  plan_path: process.argv[2] ?? "tools/data-pipeline/config/toronto-downtown-halo-500m-partitions.json",
  plan_sha256: createHash("sha256").update(await readFile(planPath)).digest("hex"),
  maximum_partition_bytes: plan.maximum_partition_bytes,
  maximum_total_bytes: plan.maximum_total_bytes,
  partitions: acquired.map((part) => ({
    id: part.id,
    selector: part.selector,
    bounds: part.bounds,
    query_sha256: createHash("sha256").update(part.query).digest("hex"),
    content_sha256: part.sha256,
    content_bytes: part.bytes.byteLength,
  })),
  content_sha256: createHash("sha256").update(merged).digest("hex"),
  content_bytes: Buffer.byteLength(merged),
  element_counts: counts,
  raw_local_path: plan.merged_path,
  pipeline_version: plan.pipeline_version,
  license: plan.license,
  attribution: plan.attribution,
  redistribution_note: "Raw and derived OSM databases remain ODbL-covered and are not committed with Apache-2.0 code.",
};
const manifestOutputIndex = process.argv.indexOf("--manifest-output");
if (manifestOutputIndex >= 0) {
  const manifestOutput = process.argv[manifestOutputIndex + 1];
  if (manifestOutput === undefined) throw new Error("--manifest-output requires a repository-relative path");
  const outputPath = resolve(root, manifestOutput);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(manifest, null, 2));
