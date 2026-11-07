import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  RoutingIndex,
  aStar,
  analyzeRoadGraph,
  deserializeRoadGraph,
  dijkstra,
  graphSha256,
  type RouteDiagnostics,
  type RouteQuery,
} from "../src/index.ts";

interface Distribution {
  readonly samples: number;
  readonly min: number;
  readonly median: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  readonly mean: number;
}

const root = fileURLToPath(new URL("../../..", import.meta.url));
const graphPath = resolve(root, "data/derived/osm-2026-11-05-pipeline2.road-graph.json");
const serialized = await readFile(graphPath);
const graph = deserializeRoadGraph(serialized);
const analysis = analyzeRoadGraph(graph, "motor_vehicle");
const largestStrongComponent = analysis.strong_components[0];
if (largestStrongComponent === undefined || largestStrongComponent.node_count < 2) throw new Error("Toronto motor graph has no routable strong component");

function distribution(values: readonly number[]): Distribution {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) throw new Error("cannot calculate an empty distribution");
  const quantile = (fraction: number): number => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    samples: sorted.length,
    min: sorted[0] ?? 0,
    median: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
    max: sorted.at(-1) ?? 0,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function metricDistribution(diagnostics: readonly RouteDiagnostics[], select: (value: RouteDiagnostics) => number): Distribution {
  return distribution(diagnostics.map(select));
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

const seed = 0x51f15e1d;
let randomState = seed;
const next = (): number => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState;
};
const nodes = largestStrongComponent.node_ids;
const queries: RouteQuery[] = [];
const seenPairs = new Set<string>();
while (queries.length < 500) {
  const start = nodes[next() % nodes.length];
  const destination = nodes[next() % nodes.length];
  if (start === undefined || destination === undefined || start === destination) continue;
  const key = `${start}\u0000${destination}`;
  if (seenPairs.has(key)) continue;
  seenPairs.add(key);
  queries.push({ start_node_id: start, destination_node_id: destination, mode: "motor_vehicle" });
}

global.gc?.();
const beforeIndexMemory = process.memoryUsage();
const indexStarted = performance.now();
const index = new RoutingIndex(graph);
const initialIndexConstructionMs = performance.now() - indexStarted;
global.gc?.();
const afterIndexMemory = process.memoryUsage();

for (const query of queries.slice(0, 50)) {
  dijkstra(index, query);
  aStar(index, query);
}

const dijkstraMs: number[] = [];
const astarMs: number[] = [];
const dijkstraDiagnostics: RouteDiagnostics[] = [];
const astarDiagnostics: RouteDiagnostics[] = [];
let agreementCount = 0;
let peakHeapUsed = process.memoryUsage().heapUsed;
let peakRss = process.memoryUsage().rss;
for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
  const query = queries[queryIndex];
  if (query === undefined) continue;
  const dijkstraStart = performance.now();
  const dijkstraResult = dijkstra(index, query);
  dijkstraMs.push(performance.now() - dijkstraStart);
  const astarStart = performance.now();
  const astarResult = aStar(index, query);
  astarMs.push(performance.now() - astarStart);
  dijkstraDiagnostics.push(dijkstraResult.diagnostics);
  astarDiagnostics.push(astarResult.diagnostics);
  if (dijkstraResult.status === astarResult.status && dijkstraResult.cost_ms === astarResult.cost_ms) agreementCount += 1;
  if (queryIndex % 20 === 0) {
    const memory = process.memoryUsage();
    peakHeapUsed = Math.max(peakHeapUsed, memory.heapUsed);
    peakRss = Math.max(peakRss, memory.rss);
  }
}
if (agreementCount !== queries.length) throw new Error(`routing correctness failure: ${queries.length - agreementCount} Dijkstra/A* disagreements`);

const coldIndexMs: number[] = [];
const coldDijkstraMs: number[] = [];
const coldAstarMs: number[] = [];
for (const query of queries.slice(0, 20)) {
  const constructionStart = performance.now();
  const coldIndex = new RoutingIndex(graph);
  coldIndexMs.push(performance.now() - constructionStart);
  const dijkstraStart = performance.now();
  dijkstra(coldIndex, query);
  coldDijkstraMs.push(performance.now() - dijkstraStart);
  const astarStart = performance.now();
  aStar(coldIndex, query);
  coldAstarMs.push(performance.now() - astarStart);
  const coldMemory = process.memoryUsage();
  peakHeapUsed = Math.max(peakHeapUsed, coldMemory.heapUsed);
  peakRss = Math.max(peakRss, coldMemory.rss);
  global.gc?.();
}

global.gc?.();
const afterQueriesMemory = process.memoryUsage();
peakHeapUsed = Math.max(peakHeapUsed, afterQueriesMemory.heapUsed);
peakRss = Math.max(peakRss, afterQueriesMemory.rss);
const report = {
  benchmark_version: 1,
  generated_at: new Date().toISOString(),
  question: "What are reference Dijkstra and restriction-equivalent A* latency, search-work, and memory baselines on the pinned Toronto Phase 1B graph?",
  command: "npm run benchmark:routing",
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
    dataset_id: graph.dataset.dataset_id,
    dataset_version: graph.dataset.dataset_version,
    graph_sha256: graphSha256(graph),
    serialized_bytes: serialized.byteLength,
    node_count: graph.nodes.length,
    directed_edge_count: graph.edges.length,
    turn_rule_count: graph.turn_rules.length,
    mode: "motor_vehicle",
    endpoint_component: "largest motor-vehicle strongly connected component",
    endpoint_component_node_count: largestStrongComponent.node_count,
    query_seed: `0x${seed.toString(16)}`,
    warmup_query_count_per_algorithm: 50,
    measured_query_count_per_algorithm: queries.length,
    cold_sample_count: 20,
  },
  correctness: {
    dijkstra_astar_status_and_cost_agreement_count: agreementCount,
    all_queries_agreed: agreementCount === queries.length,
  },
  timing_milliseconds: {
    initial_index_construction: initialIndexConstructionMs,
    warm_dijkstra: distribution(dijkstraMs),
    warm_astar: distribution(astarMs),
    cold_index_construction: distribution(coldIndexMs),
    cold_first_dijkstra_query: distribution(coldDijkstraMs),
    cold_first_astar_query_after_dijkstra: distribution(coldAstarMs),
  },
  search_work: {
    dijkstra_states_expanded: metricDistribution(dijkstraDiagnostics, (value) => value.states_expanded),
    astar_states_expanded: metricDistribution(astarDiagnostics, (value) => value.states_expanded),
    dijkstra_queue_pushes: metricDistribution(dijkstraDiagnostics, (value) => value.queue_pushes),
    astar_queue_pushes: metricDistribution(astarDiagnostics, (value) => value.queue_pushes),
    dijkstra_queue_pops: metricDistribution(dijkstraDiagnostics, (value) => value.queue_pops),
    astar_queue_pops: metricDistribution(astarDiagnostics, (value) => value.queue_pops),
  },
  memory_bytes: {
    before_index_heap_used: beforeIndexMemory.heapUsed,
    after_index_heap_used: afterIndexMemory.heapUsed,
    retained_index_heap_delta: afterIndexMemory.heapUsed - beforeIndexMemory.heapUsed,
    before_index_rss: beforeIndexMemory.rss,
    after_index_rss: afterIndexMemory.rss,
    retained_index_rss_delta: afterIndexMemory.rss - beforeIndexMemory.rss,
    after_queries_heap_used: afterQueriesMemory.heapUsed,
    after_queries_rss: afterQueriesMemory.rss,
    sampled_peak_heap_used: peakHeapUsed,
    sampled_peak_rss: peakRss,
    note: "Retained deltas use forced GC when exposed; sampled peaks are not allocator-independent process maxima.",
  },
  limitations: [
    "This bounded downtown extract is not evidence of city-scale performance.",
    "One MacBook, one Node build, and one run; results are a regression baseline rather than an SLO.",
    "The power mode and background system load were not controlled.",
    "Endpoints come from one strongly connected motor-vehicle component and do not represent a production demand distribution.",
    "Cold A* is measured after Dijkstra on the same new index; its first use includes lazy heuristic-bound construction.",
    "RSS and heap measurements include the deserialized graph and V8 allocator behavior.",
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
