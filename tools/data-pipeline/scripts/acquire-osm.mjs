import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const configPath = resolve(root, process.argv[2] ?? "tools/data-pipeline/config/toronto-downtown.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const queryPath = resolve(root, config.query_path);
const query = await readFile(queryPath, "utf8");
const destination = resolve(root, config.destination_path);
const temporary = `${destination}.partial`;
const maximumBytes = Number(config.maximum_response_bytes);

if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
  throw new Error("maximum_response_bytes must be a positive safe integer");
}

await mkdir(dirname(destination), { recursive: true });
await rm(temporary, { force: true });
try {
  await access(destination, constants.F_OK);
  throw new Error(`refusing to reacquire over existing file: ${config.destination_path}`);
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
}

const response = await fetch(config.endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "VECTORSHIFT/phase-1a (OpenStreetMap research import)",
  },
  body: new URLSearchParams({ data: query }),
  signal: AbortSignal.timeout(120_000),
});

if (!response.ok || !response.body) {
  throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
}

const declaredLength = Number(response.headers.get("content-length"));
if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
  throw new Error(`Overpass response declares ${declaredLength} bytes; cap is ${maximumBytes}`);
}

const handle = await open(temporary, "wx");
const digest = createHash("sha256");
let byteCount = 0;

try {
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > maximumBytes) {
      await reader.cancel("response exceeded configured byte cap");
      throw new Error(`Overpass response exceeded ${maximumBytes} bytes`);
    }
    digest.update(value);
    await handle.write(value);
  }
  await handle.sync();
} catch (error) {
  await handle.close();
  await rm(temporary, { force: true });
  throw error;
}

await handle.close();
try {
  await copyFile(temporary, destination, constants.COPYFILE_EXCL);
} catch (error) {
  await rm(temporary, { force: true });
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
    throw new Error(`refusing to overwrite existing acquisition: ${config.destination_path}`);
  }
  throw error;
}
await rm(temporary, { force: true });

const manifest = {
  area_id: config.area_id,
  source: "OpenStreetMap contributors via Overpass API",
  source_url: config.source_url,
  endpoint: config.endpoint,
  acquired_at: new Date().toISOString(),
  snapshot_at: config.snapshot_at,
  bounds: config.bounds,
  query_path: config.query_path,
  query_sha256: createHash("sha256").update(query).digest("hex"),
  content_sha256: digest.digest("hex"),
  content_bytes: byteCount,
  pipeline_version: config.pipeline_version,
  license: config.license,
  attribution: config.attribution,
  local_path: config.destination_path,
};

console.log(JSON.stringify(manifest, null, 2));
