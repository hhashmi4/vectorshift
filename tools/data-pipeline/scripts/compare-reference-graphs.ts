import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import process from "node:process";
import {
  RoutingIndex,
  aStar,
  analyzeRoadGraph,
  assessBoundarySupport,
  assessRestrictionSupport,
  deserializeRoadGraph,
  deserializeRoutingSupportArtifact,
  dijkstra,
  graphStatistics,
  nodeBoundaryDistanceMm,
  type FoundRoute,
  type RoadGraph,
  type RoutingSupportArtifact,
} from "../../../packages/graph/src/index.ts";

const root = process.cwd();
const execFileAsync = promisify(execFile);
const baselineGraphPath = resolve(root, "data/derived/osm-2026-11-05-pipeline3.road-graph.json");
const baselineSupportPath = resolve(root, "data/derived/osm-2026-11-05-pipeline3.routing-support.json");
const haloGraphPath = resolve(root, "data/derived/osm-2026-11-05-halo500-pipeline3.road-graph.json");
const haloSupportPath = resolve(root, "data/derived/osm-2026-11-05-halo500-pipeline3.routing-support.json");

async function load(graphPath: string, supportPath: string) {
  const [graphBytes, supportBytes] = await Promise.all([readFile(graphPath), readFile(supportPath)]);
  return {
    graph: deserializeRoadGraph(graphBytes),
    support: deserializeRoutingSupportArtifact(supportBytes),
    graph_bytes: graphBytes.byteLength,
    support_bytes: supportBytes.byteLength,
  };
}

function quantile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}

function routeDistance(graph: RoadGraph, route: FoundRoute): number {
  const byId = new Map(graph.edges.map((edge) => [edge.id, edge] as const));
  return route.edge_path.reduce((sum, edgeId) => sum + (byId.get(edgeId)?.length_mm ?? 0), 0);
}

function routeEvidence(graph: RoadGraph, support: RoutingSupportArtifact, route: ReturnType<typeof dijkstra>) {
  if (route.status === "unreachable") return { status: "unreachable" as const };
  return {
    status: "found" as const,
    cost_ms: route.cost_ms,
    distance_mm: routeDistance(graph, route),
    edge_count: route.edge_path.length,
    edge_path: route.edge_path,
    restriction_support: assessRestrictionSupport(graph, route, "motor_vehicle", support.concerns).status,
    boundary_support: assessBoundarySupport(graph, route).status,
    states_expanded: route.diagnostics.states_expanded,
  };
}

const memoryAtStart = process.memoryUsage();
const baseline = await load(baselineGraphPath, baselineSupportPath);
const baselineIndex = new RoutingIndex(baseline.graph);
const memoryAfterBaseline = process.memoryUsage();
const halo = await load(haloGraphPath, haloSupportPath);
const haloIndex = new RoutingIndex(halo.graph);
const memoryAfterHalo = process.memoryUsage();

const baselineAnalysis = analyzeRoadGraph(baseline.graph, "motor_vehicle");
const haloAnalysis = analyzeRoadGraph(halo.graph, "motor_vehicle");
const baselineComponent = baselineAnalysis.strong_components[0];
if (baselineComponent === undefined) throw new Error("baseline has no motor-vehicle strong component");
const haloNodeIds = new Set(halo.graph.nodes.map((node) => node.id));
const sampleNodes = baselineComponent.node_ids.filter((nodeId) => haloNodeIds.has(nodeId) && (nodeBoundaryDistanceMm(baseline.graph, nodeId) ?? -1) > 100_000);
if (sampleNodes.length < 2) throw new Error("not enough common core nodes to compare routes");

let randomState = 0x1d500001;
const next = (): number => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState;
};
const pairKeys = new Set<string>();
const pairs: Array<{ readonly start: string; readonly destination: string }> = [];
while (pairs.length < 500) {
  const start = sampleNodes[next() % sampleNodes.length];
  const destination = sampleNodes[next() % sampleNodes.length];
  if (start === undefined || destination === undefined || start === destination) continue;
  const key = `${start}\u0000${destination}`;
  if (pairKeys.has(key)) continue;
  pairKeys.add(key);
  pairs.push({ start, destination });
}

function runBatch(graph: RoadGraph, support: RoutingSupportArtifact, index: RoutingIndex) {
  const durations: number[] = [];
  const results = [];
  for (const pair of pairs) {
    const started = performance.now();
    const route = dijkstra(index, { start_node_id: pair.start, destination_node_id: pair.destination, mode: "motor_vehicle" });
    durations.push(performance.now() - started);
    results.push(routeEvidence(graph, support, route));
  }
  durations.sort((left, right) => left - right);
  return { results, latency_ms: { median: quantile(durations, 0.5), p95: quantile(durations, 0.95), p99: quantile(durations, 0.99), maximum: durations.at(-1) ?? 0 } };
}

const baselineBatch = runBatch(baseline.graph, baseline.support, baselineIndex);
const haloBatch = runBatch(halo.graph, halo.support, haloIndex);
const comparison = {
  both_found: 0,
  reachability_changed: 0,
  same_cost: 0,
  same_edge_path: 0,
  halo_lower_cost: 0,
  halo_higher_cost: 0,
  baseline_boundary_sensitive: 0,
  halo_boundary_sensitive: 0,
  baseline_restriction_unsupported: 0,
  halo_restriction_unsupported: 0,
};
for (let index = 0; index < pairs.length; index += 1) {
  const before = baselineBatch.results[index];
  const after = haloBatch.results[index];
  if (before === undefined || after === undefined) continue;
  if (before.status !== after.status) comparison.reachability_changed += 1;
  if (before.status !== "found" || after.status !== "found") continue;
  comparison.both_found += 1;
  if (before.cost_ms === after.cost_ms) comparison.same_cost += 1;
  else if (after.cost_ms < before.cost_ms) comparison.halo_lower_cost += 1;
  else comparison.halo_higher_cost += 1;
  if (JSON.stringify(before.edge_path) === JSON.stringify(after.edge_path)) comparison.same_edge_path += 1;
  if (before.boundary_support === "boundary_sensitive") comparison.baseline_boundary_sensitive += 1;
  if (after.boundary_support === "boundary_sensitive") comparison.halo_boundary_sensitive += 1;
  if (before.restriction_support === "unsupported") comparison.baseline_restriction_unsupported += 1;
  if (after.restriction_support === "unsupported") comparison.halo_restriction_unsupported += 1;
}

const observedQuery = { start_node_id: "node:osm:11209519166", destination_node_id: "node:osm:391174586", mode: "motor_vehicle" as const };
function observed(graph: RoadGraph, support: RoutingSupportArtifact, index: RoutingIndex) {
  const dijkstraRoute = dijkstra(index, observedQuery);
  const astarRoute = aStar(index, observedQuery);
  const dijkstraEvidence = routeEvidence(graph, support, dijkstraRoute);
  const astarEvidence = routeEvidence(graph, support, astarRoute);
  return { dijkstra: dijkstraEvidence, astar: astarEvidence, algorithms_agree: dijkstraRoute.status === astarRoute.status && dijkstraRoute.cost_ms === astarRoute.cost_ms };
}

async function isolatedMemoryMeasurement(path: string) {
  const { stdout } = await execFileAsync(process.execPath, ["--expose-gc", "tools/data-pipeline/scripts/measure-graph-memory.ts", path], { cwd: root, maxBuffer: 2_000_000 });
  return JSON.parse(stdout) as unknown;
}
const isolatedMemoryMeasurements = {
  baseline: await isolatedMemoryMeasurement("data/derived/osm-2026-11-05-pipeline3.road-graph.json"),
  halo: await isolatedMemoryMeasurement("data/derived/osm-2026-11-05-halo500-pipeline3.road-graph.json"),
};

const result = {
  comparison_version: 1,
  generated_at: new Date().toISOString(),
  environment: { platform: process.platform, architecture: process.arch, node: process.version, cpu_model: os.cpus()[0]?.model ?? "unknown" },
  methodology: { sample_count: pairs.length, seed: "0x1d500001", endpoints: "baseline largest motor SCC, common to halo, more than 100 m inside baseline bounds", algorithm: "Dijkstra" },
  baseline: {
    dataset_version: baseline.graph.dataset.dataset_version,
    graph_sha256: baseline.support.graph_sha256,
    graph_bytes: baseline.graph_bytes,
    support_bytes: baseline.support_bytes,
    statistics: graphStatistics(baseline.graph),
    motor_largest_strong_component_nodes: baselineAnalysis.strong_components[0]?.node_count ?? 0,
    route_latency_ms: baselineBatch.latency_ms,
  },
  halo: {
    dataset_version: halo.graph.dataset.dataset_version,
    graph_sha256: halo.support.graph_sha256,
    graph_bytes: halo.graph_bytes,
    support_bytes: halo.support_bytes,
    statistics: graphStatistics(halo.graph),
    motor_largest_strong_component_nodes: haloAnalysis.strong_components[0]?.node_count ?? 0,
    route_latency_ms: haloBatch.latency_ms,
  },
  common_core_endpoint_nodes: sampleNodes.length,
  route_comparison: comparison,
  observed_phase1c_query: { query: observedQuery, baseline: observed(baseline.graph, baseline.support, baselineIndex), halo: observed(halo.graph, halo.support, haloIndex) },
  isolated_memory_measurements: isolatedMemoryMeasurements,
  process_memory_bytes: { at_start: memoryAtStart, after_baseline_load_and_index: memoryAfterBaseline, after_halo_load_and_index: memoryAfterHalo },
  limitations: [
    "The latency batches run sequentially in one process and are not an isolated index-memory benchmark.",
    "A larger halo reduces but does not eliminate acquisition-boundary effects.",
    "Path differences can reflect added topology, added restrictions, or deterministic tie-breaking over a larger graph and require route-level inspection before publication.",
  ],
};

const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (output === undefined) throw new Error("--output requires a path");
  const outputPath = resolve(root, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
