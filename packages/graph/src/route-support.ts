import type { OsmRestrictionConcern } from "./osm-restrictions.ts";
import type { FoundRoute } from "./routing.ts";
import type { CoordinateE7, DirectedRoadEdge, RoadGraph, TravelMode } from "./types.ts";

export interface MatchedRestrictionConcern {
  readonly relation_id: number;
  readonly category: OsmRestrictionConcern["category"];
  readonly message: string;
}

export interface RestrictionSupportAssessment {
  readonly status: "supported" | "unsupported";
  readonly matched_concerns: readonly MatchedRestrictionConcern[];
}

export interface BoundarySupportAssessment {
  readonly status: "supported" | "boundary_sensitive";
  readonly buffer_mm: number;
  readonly minimum_boundary_distance_mm: number;
  readonly outside_bounds_node_ids: readonly string[];
  readonly message: string;
}

function wayId(edge: DirectedRoadEdge): number | undefined {
  const match = /^way:(\d+):segment:/.exec(edge.source_segment_id);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function osmNodeId(nodeId: string): number | undefined {
  const match = /^node:osm:(\d+)$/.exec(nodeId);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function transitionMatches(
  concern: OsmRestrictionConcern,
  incoming: DirectedRoadEdge,
  outgoing: DirectedRoadEdge,
): boolean {
  const incomingWay = wayId(incoming);
  const outgoingWay = wayId(outgoing);
  if (incomingWay === undefined || outgoingWay === undefined || !concern.from_way_ids.includes(incomingWay)) return false;
  const viaNode = osmNodeId(incoming.target_node_id);
  if (concern.via_node_ids.length > 0 && (viaNode === undefined || !concern.via_node_ids.includes(viaNode))) return false;
  if (concern.restriction.startsWith("only_")) return !concern.to_way_ids.includes(outgoingWay);
  return concern.to_way_ids.includes(outgoingWay);
}

function viaWaySequenceMatches(concern: OsmRestrictionConcern, edges: readonly DirectedRoadEdge[]): boolean {
  if (concern.via_way_ids.length === 0) return false;
  const collapsed: number[] = [];
  for (const edge of edges) {
    const value = wayId(edge);
    if (value !== undefined && collapsed.at(-1) !== value) collapsed.push(value);
  }
  const expectedPrefix = [concern.from_way_ids[0], ...concern.via_way_ids].filter((value): value is number => value !== undefined);
  for (let index = 0; index <= collapsed.length - expectedPrefix.length - 1; index += 1) {
    if (!expectedPrefix.every((value, offset) => collapsed[index + offset] === value)) continue;
    const exit = collapsed[index + expectedPrefix.length];
    if (exit === undefined) continue;
    if (concern.restriction.startsWith("only_")) return !concern.to_way_ids.includes(exit);
    return concern.to_way_ids.includes(exit);
  }
  return false;
}

export function assessRestrictionSupport(
  graph: RoadGraph,
  route: FoundRoute,
  mode: TravelMode,
  concerns: readonly OsmRestrictionConcern[],
): RestrictionSupportAssessment {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge] as const));
  const edges = route.edge_path.map((edgeId) => edgeById.get(edgeId)).filter((edge): edge is DirectedRoadEdge => edge !== undefined);
  const matched: MatchedRestrictionConcern[] = [];
  for (const concern of concerns) {
    if (!concern.affected_modes.includes(mode)) continue;
    let affected = viaWaySequenceMatches(concern, edges);
    if (!affected) {
      for (let index = 0; index < edges.length - 1; index += 1) {
        const incoming = edges[index];
        const outgoing = edges[index + 1];
        if (incoming !== undefined && outgoing !== undefined && transitionMatches(concern, incoming, outgoing)) {
          affected = true;
          break;
        }
      }
    }
    if (affected) matched.push({ relation_id: concern.relation_id, category: concern.category, message: concern.message });
  }
  matched.sort((left, right) => left.relation_id - right.relation_id || (left.category < right.category ? -1 : 1));
  return { status: matched.length === 0 ? "supported" : "unsupported", matched_concerns: matched };
}

function coordinateInsideBounds(graph: RoadGraph, coordinate: CoordinateE7): boolean {
  const bounds = graph.dataset.source.bounds;
  return coordinate[0] >= bounds.west_e7 && coordinate[0] <= bounds.east_e7
    && coordinate[1] >= bounds.south_e7 && coordinate[1] <= bounds.north_e7;
}

function boundaryDistanceMm(graph: RoadGraph, coordinate: CoordinateE7): number {
  const bounds = graph.dataset.source.bounds;
  const latitudeRadians = coordinate[1] / 10_000_000 * Math.PI / 180;
  const millimetresPerE7Latitude = 111_195_080 / 10_000_000;
  const millimetresPerE7Longitude = millimetresPerE7Latitude * Math.cos(latitudeRadians);
  return Math.max(0, Math.floor(Math.min(
    Math.abs(coordinate[0] - bounds.west_e7) * millimetresPerE7Longitude,
    Math.abs(bounds.east_e7 - coordinate[0]) * millimetresPerE7Longitude,
    Math.abs(coordinate[1] - bounds.south_e7) * millimetresPerE7Latitude,
    Math.abs(bounds.north_e7 - coordinate[1]) * millimetresPerE7Latitude,
  )));
}

export function assessBoundarySupport(
  graph: RoadGraph,
  route: FoundRoute,
  bufferMm = 100_000,
): BoundarySupportAssessment {
  if (!Number.isSafeInteger(bufferMm) || bufferMm < 0) throw new TypeError("boundary buffer must be a non-negative safe integer");
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const routeNodes = route.node_path.map((nodeId) => nodeById.get(nodeId)).filter((node) => node !== undefined);
  const outside = routeNodes.filter((node) => !coordinateInsideBounds(graph, node.coordinate_e7)).map((node) => node.id).sort();
  const minimum = routeNodes.reduce((value, node) => Math.min(value, boundaryDistanceMm(graph, node.coordinate_e7)), Number.POSITIVE_INFINITY);
  const boundarySensitive = outside.length > 0 || minimum <= bufferMm;
  return {
    status: boundarySensitive ? "boundary_sensitive" : "supported",
    buffer_mm: bufferMm,
    minimum_boundary_distance_mm: Number.isFinite(minimum) ? minimum : 0,
    outside_bounds_node_ids: outside,
    message: boundarySensitive
      ? "The route reaches outside or within the configured buffer of the acquisition boundary; omitted roads may change its correctness."
      : "The route remains inside the configured core buffer; this reduces but does not eliminate source completeness risk.",
  };
}

export function nodeBoundaryDistanceMm(graph: RoadGraph, nodeId: string): number | undefined {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  return node === undefined || !coordinateInsideBounds(graph, node.coordinate_e7) ? undefined : boundaryDistanceMm(graph, node.coordinate_e7);
}
