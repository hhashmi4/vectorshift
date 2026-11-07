import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import {
  RoutingIndex,
  analyzeRoadGraph,
  assessBoundarySupport,
  assessRestrictionSupport,
  deserializeRoadGraph,
  deserializeRoutingSupportArtifact,
  dijkstra,
  nodeBoundaryDistanceMm,
  type CoordinateE7,
} from "../../../packages/graph/src/index.ts";

const root = process.cwd();
const graphPath = resolve(root, "data/derived/osm-2026-11-05-pipeline3.road-graph.json");
const supportPath = resolve(root, "data/derived/osm-2026-11-05-pipeline3.routing-support.json");
const graph = deserializeRoadGraph(await readFile(graphPath));
const support = deserializeRoutingSupportArtifact(await readFile(supportPath));
const bounds = graph.dataset.source.bounds;
const inside = (coordinate: CoordinateE7): boolean => coordinate[0] >= bounds.west_e7 && coordinate[0] <= bounds.east_e7
  && coordinate[1] >= bounds.south_e7 && coordinate[1] <= bounds.north_e7;
const wayId = (sourceSegmentId: string): number | undefined => {
  const match = /^way:(\d+):segment:/.exec(sourceSegmentId);
  return match?.[1] === undefined ? undefined : Number(match[1]);
};

const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
const insideNodeIds = new Set(graph.nodes.filter((node) => inside(node.coordinate_e7)).map((node) => node.id));
const outsideNodes = graph.nodes.filter((node) => !inside(node.coordinate_e7));
const nodesByWay = new Map<number, Set<string>>();
const waysByNode = new Map<string, Set<number>>();
for (const edge of graph.edges) {
  const id = wayId(edge.source_segment_id);
  if (id === undefined) continue;
  const wayNodes = nodesByWay.get(id) ?? new Set<string>();
  wayNodes.add(edge.source_node_id);
  wayNodes.add(edge.target_node_id);
  nodesByWay.set(id, wayNodes);
  for (const nodeId of [edge.source_node_id, edge.target_node_id]) {
    const nodeWays = waysByNode.get(nodeId) ?? new Set<number>();
    nodeWays.add(id);
    waysByNode.set(nodeId, nodeWays);
  }
}

const intentionalOutside: string[] = [];
const unexplainedOutside: string[] = [];
for (const node of outsideNodes) {
  const incidentWays = waysByNode.get(node.id) ?? new Set<number>();
  const sharesWayWithInside = [...incidentWays].some((id) => [...(nodesByWay.get(id) ?? [])].some((nodeId) => insideNodeIds.has(nodeId)));
  (sharesWayWithInside ? intentionalOutside : unexplainedOutside).push(node.id);
}

let crossingEdgeCount = 0;
let outsideOnlyEdgeCount = 0;
for (const edge of graph.edges) {
  const sourceInside = insideNodeIds.has(edge.source_node_id);
  const targetInside = insideNodeIds.has(edge.target_node_id);
  if (sourceInside !== targetInside) crossingEdgeCount += 1;
  else if (!sourceInside && !targetInside) outsideOnlyEdgeCount += 1;
}

const latitudeMmPerE7 = 111_195_080 / 10_000_000;
const longitudeMmPerE7 = latitudeMmPerE7 * Math.cos(43.6482 * Math.PI / 180);
const excursions = outsideNodes.map((node) => ({
  west_mm: Math.max(0, bounds.west_e7 - node.coordinate_e7[0]) * longitudeMmPerE7,
  east_mm: Math.max(0, node.coordinate_e7[0] - bounds.east_e7) * longitudeMmPerE7,
  south_mm: Math.max(0, bounds.south_e7 - node.coordinate_e7[1]) * latitudeMmPerE7,
  north_mm: Math.max(0, node.coordinate_e7[1] - bounds.north_e7) * latitudeMmPerE7,
}));

const analysis = analyzeRoadGraph(graph, "motor_vehicle");
const component = analysis.strong_components[0];
if (component === undefined) throw new Error("motor graph has no strong component");
const index = new RoutingIndex(graph);
let randomState = 0x1c0b0a7;
const next = (): number => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState;
};
const allNodes = component.node_ids;
const coreNodes = allNodes.filter((nodeId) => (nodeBoundaryDistanceMm(graph, nodeId) ?? -1) > 100_000);

function sampleRoutes(nodes: readonly string[], sampleCount: number) {
  const seen = new Set<string>();
  let found = 0;
  let unreachable = 0;
  let boundarySupported = 0;
  let boundarySensitive = 0;
  let restrictionUnsupported = 0;
  while (seen.size < sampleCount) {
    const start = nodes[next() % nodes.length];
    const destination = nodes[next() % nodes.length];
    if (start === undefined || destination === undefined || start === destination) continue;
    const key = `${start}\u0000${destination}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const route = dijkstra(index, { start_node_id: start, destination_node_id: destination, mode: "motor_vehicle" });
    if (route.status === "unreachable") {
      unreachable += 1;
      continue;
    }
    found += 1;
    if (assessRestrictionSupport(graph, route, "motor_vehicle", support.concerns).status === "unsupported") restrictionUnsupported += 1;
    const boundary = assessBoundarySupport(graph, route);
    if (boundary.status === "supported") boundarySupported += 1;
    else boundarySensitive += 1;
  }
  return { sample_count: sampleCount, found, unreachable, boundary_supported: boundarySupported, boundary_sensitive: boundarySensitive, restriction_unsupported: restrictionUnsupported };
}

const report = {
  audit_version: 1,
  generated_at: new Date().toISOString(),
  environment: { platform: process.platform, architecture: process.arch, node: process.version, cpu_model: os.cpus()[0]?.model ?? "unknown" },
  graph: { dataset_version: graph.dataset.dataset_version, graph_sha256: support.graph_sha256, node_count: graph.nodes.length, edge_count: graph.edges.length },
  acquisition_bounds_e7: bounds,
  outside_nodes: {
    total: outsideNodes.length,
    on_retained_way_with_inside_node: intentionalOutside.length,
    not_connected_by_retained_way_to_inside_node: unexplainedOutside.length,
    maximum_excursion_mm: {
      west: Math.round(Math.max(...excursions.map((item) => item.west_mm))),
      east: Math.round(Math.max(...excursions.map((item) => item.east_mm))),
      south: Math.round(Math.max(...excursions.map((item) => item.south_mm))),
      north: Math.round(Math.max(...excursions.map((item) => item.north_mm))),
    },
  },
  edges: { crossing_bounds: crossingEdgeCount, outside_only: outsideOnlyEdgeCount },
  endpoint_sets: { largest_motor_strong_component: allNodes.length, core_buffer_100m: coreNodes.length },
  route_samples: {
    all_component_endpoints: sampleRoutes(allNodes, 500),
    core_buffered_endpoints: sampleRoutes(coreNodes, 500),
    seed: "0x1c0b0a7",
  },
  halo_candidate: {
    distance_m: 500,
    bounds: { south: 43.638108, west: -79.396710, north: 43.658292, east: -79.364290 },
    query_path: "tools/data-pipeline/queries/toronto-downtown-roads-halo-500m.overpassql",
    status: "procedure prepared; comparison requires a separately acquired content-addressed response",
  },
  limitations: [
    "A node sharing a retained way with an inside node is consistent with Overpass member expansion, but this test does not prove source completeness.",
    "The 100 m core buffer is a Phase 1C diagnostic policy, not a proof that omitted roads cannot affect a route.",
    "Component and route samples use one pinned extract and fixed synthetic endpoint distribution.",
  ],
};

const outputFlagIndex = process.argv.indexOf("--output");
if (outputFlagIndex < 0 || process.argv[outputFlagIndex + 1] === undefined) console.log(JSON.stringify(report, null, 2));
else {
  const output = resolve(root, process.argv[outputFlagIndex + 1]!);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${relative(root, output)}`);
}
