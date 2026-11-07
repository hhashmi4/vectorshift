import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  RoutingIndex,
  aStar,
  analyzeRoadGraph,
  assessBoundarySupport,
  assessRestrictionSupport,
  deserializeRoadGraph,
  deserializeRoutingSupportArtifact,
  dijkstra,
  graphSha256,
  nodeBoundaryDistanceMm,
  type DirectedRoadEdge,
  type RoadGraph,
  type RoutingSupportArtifact,
  type TravelMode,
} from "../../../../packages/graph/src/index.ts";
import type {
  EndpointView,
  FeatureCollection,
  LineFeature,
  NetworkView,
  RouteRequestView,
  RouteResponseView,
  WebTravelMode,
} from "../contracts.ts";

interface LoadedRoutingData {
  readonly graph: RoadGraph;
  readonly support: RoutingSupportArtifact;
  readonly index: RoutingIndex;
  readonly graph_sha256: string;
}

let loadedPromise: Promise<LoadedRoutingData> | undefined;
const networkCache = new Map<WebTravelMode, NetworkView>();

function repositoryRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), "../..")];
  const found = candidates.find((candidate) => existsSync(resolve(candidate, "package.json")) && existsSync(resolve(candidate, "packages/graph")));
  if (found === undefined) throw new Error("unable to locate VECTORSHIFT repository root");
  return found;
}

function artifactPath(environmentValue: string | undefined, fallback: string): string {
  const value = environmentValue ?? fallback;
  return isAbsolute(value) ? value : resolve(repositoryRoot(), value);
}

export async function loadRoutingData(): Promise<LoadedRoutingData> {
  loadedPromise ??= (async () => {
    const [graphBytes, supportBytes, manifestBytes] = await Promise.all([
      readFile(artifactPath(process.env.VECTORSHIFT_GRAPH_PATH, "data/derived/osm-2026-11-05-pipeline3.road-graph.json")),
      readFile(artifactPath(process.env.VECTORSHIFT_ROUTING_SUPPORT_PATH, "data/derived/osm-2026-11-05-pipeline3.routing-support.json")),
      readFile(artifactPath(process.env.VECTORSHIFT_GRAPH_MANIFEST_PATH, "data/manifests/toronto-downtown-2026-11-05-pipeline3.json")),
    ]);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as { derived?: { graph_sha256?: string; routing_support_sha256?: string } };
    const graph = deserializeRoadGraph(graphBytes);
    const support = deserializeRoutingSupportArtifact(supportBytes);
    const digest = graphSha256(graph);
    const expectedGraphDigest = process.env.VECTORSHIFT_GRAPH_SHA256 ?? manifest.derived?.graph_sha256;
    const expectedSupportDigest = process.env.VECTORSHIFT_ROUTING_SUPPORT_SHA256 ?? manifest.derived?.routing_support_sha256;
    if (expectedGraphDigest === undefined || expectedSupportDigest === undefined) throw new Error("publication manifest is missing graph or routing-support integrity metadata");
    if (digest !== expectedGraphDigest) throw new Error("graph artifact does not match the publication manifest");
    const supportDigest = createHash("sha256").update(supportBytes).digest("hex");
    if (supportDigest !== expectedSupportDigest) throw new Error("routing support artifact does not match the publication manifest");
    if (support.graph_sha256 !== digest) throw new Error("routing support artifact does not match the graph artifact");
    return { graph, support, index: new RoutingIndex(graph), graph_sha256: digest };
  })();
  return loadedPromise;
}

function edgeFeature(edge: DirectedRoadEdge): LineFeature {
  return {
    type: "Feature",
    properties: { id: edge.id, hierarchy: edge.hierarchy, modes: edge.modes },
    geometry: {
      type: "LineString",
      coordinates: edge.geometry_e7.map((point) => [point[0] / 10_000_000, point[1] / 10_000_000] as [number, number]),
    },
  };
}

export function buildNetworkView(data: LoadedRoutingData, mode: WebTravelMode): NetworkView {
  const analysis = analyzeRoadGraph(data.graph, mode);
  const component = analysis.strong_components[0];
  const componentNodes = new Set(component?.node_ids ?? []);
  const nodeById = new Map(data.graph.nodes.map((node) => [node.id, node] as const));
  const endpoints: EndpointView[] = [...componentNodes]
    .map((nodeId) => ({ nodeId, node: nodeById.get(nodeId), boundary: nodeBoundaryDistanceMm(data.graph, nodeId) }))
    .filter((entry) => entry.node !== undefined && entry.boundary !== undefined && entry.boundary > 100_000)
    .map((entry) => ({
      id: entry.nodeId,
      longitude: entry.node!.coordinate_e7[0] / 10_000_000,
      latitude: entry.node!.coordinate_e7[1] / 10_000_000,
      boundary_distance_m: Math.floor((entry.boundary ?? 0) / 1_000),
    }))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  let suggestedPair: { start_node_id: string; destination_node_id: string } | null = null;
  for (let attempt = 0; attempt < Math.min(40, endpoints.length); attempt += 1) {
    const first = endpoints[(attempt * 37) % endpoints.length];
    const second = endpoints[(Math.floor(endpoints.length / 2) + attempt * 53) % endpoints.length];
    if (first === undefined || second === undefined || first.id === second.id) continue;
    const candidate = dijkstra(data.index, { start_node_id: first.id, destination_node_id: second.id, mode });
    if (candidate.status !== "found") continue;
    if (assessRestrictionSupport(data.graph, candidate, mode, data.support.concerns).status !== "supported") continue;
    if (assessBoundarySupport(data.graph, candidate).status !== "supported") continue;
    suggestedPair = { start_node_id: first.id, destination_node_id: second.id };
    break;
  }
  return {
    status: "ready",
    graph: {
      dataset_version: data.graph.dataset.dataset_version,
      graph_sha256: data.graph_sha256,
      node_count: data.graph.nodes.length,
      edge_count: data.graph.edges.length,
      turn_rule_count: data.graph.turn_rules.length,
    },
    mode,
    network: { type: "FeatureCollection", features: data.graph.edges.filter((edge) => edge.modes.includes(mode)).map(edgeFeature) },
    endpoints,
    suggested_pair: suggestedPair,
    attribution: "Road data © OpenStreetMap contributors (ODbL). Optional basemap attribution is shown separately.",
    disclosure: "Traversal costs are deterministic synthetic free-flow weights, not observed traffic or a traffic prediction.",
  };
}

export async function networkView(mode: WebTravelMode): Promise<NetworkView> {
  const cached = networkCache.get(mode);
  if (cached !== undefined) return cached;
  const view = buildNetworkView(await loadRoutingData(), mode);
  networkCache.set(mode, view);
  return view;
}

function routeGeometry(graph: RoadGraph, edgePath: readonly string[]): { readonly geometry: LineFeature; readonly distanceMm: number } {
  const byId = new Map(graph.edges.map((edge) => [edge.id, edge] as const));
  const coordinates: Array<[number, number]> = [];
  let distanceMm = 0;
  let expectedSource: string | undefined;
  for (const edgeId of edgePath) {
    const edge = byId.get(edgeId);
    if (edge === undefined) throw new Error(`route references unknown edge ${edgeId}`);
    if (expectedSource !== undefined && edge.source_node_id !== expectedSource) throw new Error("route geometry is not topologically contiguous");
    const points = edge.geometry_e7.map((point) => [point[0] / 10_000_000, point[1] / 10_000_000] as [number, number]);
    coordinates.push(...(coordinates.length === 0 ? points : points.slice(1)));
    distanceMm += edge.length_mm;
    expectedSource = edge.target_node_id;
  }
  return {
    geometry: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
    distanceMm,
  };
}

export function computeRouteView(data: LoadedRoutingData, request: RouteRequestView): RouteResponseView {
  const started = performance.now();
  const query = { start_node_id: request.start_node_id, destination_node_id: request.destination_node_id, mode: request.mode as TravelMode };
  const result = request.algorithm === "dijkstra" ? dijkstra(data.index, query) : aStar(data.index, query);
  if (result.status === "unreachable") return { status: "unreachable", message: "No directed route exists for the selected mode and endpoints." };
  const restriction = assessRestrictionSupport(data.graph, result, request.mode, data.support.concerns);
  if (restriction.status === "unsupported") return {
    status: "unsupported",
    reason: "restriction_semantics",
    message: "The candidate path intersects OSM restriction semantics this graph version cannot evaluate safely. No route is presented.",
    relation_ids: restriction.matched_concerns.map((concern) => concern.relation_id),
    categories: [...new Set(restriction.matched_concerns.map((concern) => concern.category))].sort(),
    graph_sha256: data.graph_sha256,
    dataset_version: data.graph.dataset.dataset_version,
  };
  const { geometry, distanceMm } = routeGeometry(data.graph, result.edge_path);
  const boundary = assessBoundarySupport(data.graph, result);
  return {
    status: "found",
    edge_path: result.edge_path,
    geometry,
    cost_ms: result.cost_ms,
    distance_mm: distanceMm,
    algorithm: request.algorithm,
    mode: request.mode,
    graph_sha256: data.graph_sha256,
    dataset_version: data.graph.dataset.dataset_version,
    boundary: { status: boundary.status, minimum_boundary_distance_mm: boundary.minimum_boundary_distance_mm, message: boundary.message },
    diagnostics: {
      states_expanded: result.diagnostics.states_expanded,
      queue_pushes: result.diagnostics.queue_pushes,
      server_compute_ms: performance.now() - started,
      u_turn_policy: data.support.u_turn_policy,
    },
  };
}

export type { LoadedRoutingData };
