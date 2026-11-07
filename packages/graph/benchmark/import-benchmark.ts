import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  graphSha256,
  graphStatistics,
  importOsmOverpassRoadGraph,
  serializeRoadGraph,
  type GraphDatasetMetadata,
  type OsmOverpassDocument,
} from "../src/index.ts";

interface Manifest {
  readonly dataset_id: string;
  readonly dataset_version: string;
  readonly source: string;
  readonly source_url: string;
  readonly acquired_at: string;
  readonly snapshot_at: string;
  readonly bounds: { readonly south: number; readonly west: number; readonly north: number; readonly east: number };
  readonly content_sha256: string;
  readonly raw_local_path: string;
  readonly pipeline_version: string;
  readonly license: string;
  readonly attribution: string;
  readonly derived_graph?: { readonly graph_sha256: string };
}

interface Distribution {
  readonly samples: number;
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
  readonly mean: number;
}

const root = fileURLToPath(new URL("../../..", import.meta.url));
const repetitions = 10;
const warmups = 3;
const manifestPath = resolve(root, "data/manifests/toronto-downtown-2026-11-05.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const rawPath = resolve(root, manifest.raw_local_path);
const rawBytes = await readFile(rawPath);
const rawText = rawBytes.toString("utf8");
const sourceDigest = createHash("sha256").update(rawBytes).digest("hex");
if (sourceDigest !== manifest.content_sha256) throw new Error("benchmark input hash does not match acquisition manifest");

const dataset: GraphDatasetMetadata = {
  dataset_id: manifest.dataset_id,
  dataset_version: manifest.dataset_version,
  source: {
    provider: manifest.source,
    source_uri: manifest.source_url,
    license: manifest.license,
    attribution: manifest.attribution,
    acquired_at: manifest.acquired_at,
    snapshot_at: manifest.snapshot_at,
    bounds: {
      south_e7: Math.round(manifest.bounds.south * 10_000_000),
      west_e7: Math.round(manifest.bounds.west * 10_000_000),
      north_e7: Math.round(manifest.bounds.north * 10_000_000),
      east_e7: Math.round(manifest.bounds.east * 10_000_000),
    },
    source_sha256: manifest.content_sha256,
    pipeline_version: manifest.pipeline_version,
  },
};

function distribution(values: readonly number[]): Distribution {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) throw new Error("cannot calculate an empty distribution");
  const quantile = (fraction: number): number => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    samples: sorted.length,
    min: sorted[0] ?? 0,
    median: quantile(0.5),
    p95: quantile(0.95),
    max: sorted.at(-1)!,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

async function implementationDigest(): Promise<string> {
  const sourceDirectory = resolve(root, "packages/graph/src");
  const names = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".ts")).sort();
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name);
    hash.update("\0");
    hash.update(await readFile(resolve(sourceDirectory, name)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

for (let index = 0; index < warmups; index += 1) {
  const document = JSON.parse(rawText) as OsmOverpassDocument;
  const result = importOsmOverpassRoadGraph(document, dataset);
  serializeRoadGraph(result.graph);
}

const parseMs: number[] = [];
const importMs: number[] = [];
const serializeMs: number[] = [];
const endToEndMs: number[] = [];
const digests = new Set<string>();
let referenceGraph: ReturnType<typeof importOsmOverpassRoadGraph>["graph"] | undefined;

for (let index = 0; index < repetitions; index += 1) {
  const endToEndStart = performance.now();
  const parseStart = performance.now();
  const document = JSON.parse(rawText) as OsmOverpassDocument;
  parseMs.push(performance.now() - parseStart);
  const importStart = performance.now();
  const result = importOsmOverpassRoadGraph(document, dataset);
  importMs.push(performance.now() - importStart);
  const serializeStart = performance.now();
  serializeRoadGraph(result.graph);
  serializeMs.push(performance.now() - serializeStart);
  endToEndMs.push(performance.now() - endToEndStart);
  digests.add(graphSha256(result.graph));
  referenceGraph = result.graph;
}

if (digests.size !== 1) throw new Error(`determinism failure: observed ${digests.size} graph digests`);
const graphDigest = [...digests][0];
if (manifest.derived_graph && manifest.derived_graph.graph_sha256 !== graphDigest) {
  throw new Error(`graph digest changed: expected ${manifest.derived_graph.graph_sha256}, observed ${graphDigest}`);
}

global.gc?.();
const baselineMemory = process.memoryUsage();
const retainedDocument = JSON.parse(rawText) as OsmOverpassDocument;
const retainedResult = importOsmOverpassRoadGraph(retainedDocument, dataset);
const retainedSerialized = serializeRoadGraph(retainedResult.graph);
global.gc?.();
const retainedMemory = process.memoryUsage();
void retainedDocument;
void retainedResult;
void retainedSerialized;

const report = {
  benchmark_version: 1,
  generated_at: new Date().toISOString(),
  question: "What are the parse, validated OSM import, canonical serialization, and retained-memory baselines for the pinned Phase 1A Toronto reference input?",
  command: "npm run benchmark:graph",
  warmup_runs: warmups,
  measured_runs: repetitions,
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    cpu_model: os.cpus()[0]?.model ?? "unknown",
    logical_cpu_count: os.cpus().length,
    total_memory_bytes: os.totalmem(),
    power_mode: "not recorded",
    source_commit: "unavailable: repository has no commits",
    graph_implementation_sha256: await implementationDigest(),
  },
  workload: {
    dataset_id: manifest.dataset_id,
    dataset_version: manifest.dataset_version,
    raw_source_sha256: sourceDigest,
    raw_source_bytes: rawBytes.byteLength,
    graph_sha256: graphDigest,
    statistics: graphStatistics(referenceGraph!),
  },
  correctness: {
    all_run_graph_digests_identical: digests.size === 1,
    expected_manifest_digest_matched: manifest.derived_graph?.graph_sha256 === graphDigest,
  },
  timing_milliseconds: {
    json_parse: distribution(parseMs),
    validated_import: distribution(importMs),
    canonical_serialization: distribution(serializeMs),
    end_to_end: distribution(endToEndMs),
  },
  retained_memory_bytes: {
    baseline_heap_used: baselineMemory.heapUsed,
    retained_heap_used: retainedMemory.heapUsed,
    heap_used_delta: retainedMemory.heapUsed - baselineMemory.heapUsed,
    baseline_rss: baselineMemory.rss,
    retained_rss: retainedMemory.rss,
    rss_delta: retainedMemory.rss - baselineMemory.rss,
    note: "Single-process retained delta after forced GC; includes parsed OSM document, graph, and serialized artifact and is not a peak-memory measurement.",
  },
  limitations: [
    "One MacBook configuration and one Node.js build; no cross-machine generalization.",
    "Ten measured runs are an engineering baseline, not an SLO or statistically mature regression threshold.",
    "Power mode was not recorded and background system load was not controlled.",
    "The repository has no commit, so the graph source-tree digest identifies the implementation under test.",
    "Turn-restriction relations are counted but not imported in Phase 1A.",
    "Retained-memory delta is sensitive to V8 garbage collection and allocator behavior.",
  ],
};

const outputFlagIndex = process.argv.indexOf("--output");
if (outputFlagIndex >= 0) {
  const requested = process.argv[outputFlagIndex + 1];
  if (!requested) throw new Error("--output requires a repository-relative path");
  const outputPath = resolve(root, requested);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${relative(root, outputPath)}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}
