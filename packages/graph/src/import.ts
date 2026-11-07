import {
  COORDINATE_SCALE,
  GRAPH_FORMAT,
  GRAPH_SCHEMA_VERSION,
  type CoordinateE7,
  type DirectedRoadEdge,
  type RoadGraph,
  type RoadGraphImportInput,
} from "./types.ts";
import { assertValidGraph } from "./validation.ts";

export class GraphImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphImportError";
  }
}

function encodeIdComponent(value: string): string {
  if (value.length === 0) throw new GraphImportError("source identifiers must not be empty");
  return encodeURIComponent(value);
}

export function internalNodeId(namespace: string, sourceNodeId: string): string {
  return `node:${encodeIdComponent(namespace)}:${encodeIdComponent(sourceNodeId)}`;
}

export function internalEdgeId(
  namespace: string,
  sourceSegmentId: string,
  direction: "forward" | "reverse",
): string {
  return `edge:${encodeIdComponent(namespace)}:${encodeIdComponent(sourceSegmentId)}:${direction}`;
}

function cloneCoordinate(coordinate: CoordinateE7): CoordinateE7 {
  return [coordinate[0], coordinate[1]];
}

export function importRoadGraph(input: RoadGraphImportInput): RoadGraph {
  const nodeIdBySource = new Map<string, string>();
  const nodes = input.nodes.map((node) => {
    const id = internalNodeId(input.namespace, node.source_node_id);
    if (!nodeIdBySource.has(node.source_node_id)) nodeIdBySource.set(node.source_node_id, id);
    return {
      id,
      coordinate_e7: cloneCoordinate(node.coordinate_e7),
      source: { namespace: input.namespace, source_id: node.source_node_id },
    };
  });

  const coordinateBySource = new Map(
    input.nodes.map((node) => [node.source_node_id, cloneCoordinate(node.coordinate_e7)] as const),
  );
  const edges: DirectedRoadEdge[] = [];

  for (const segment of input.segments) {
    const fromId = nodeIdBySource.get(segment.from_source_node_id)
      ?? internalNodeId(input.namespace, segment.from_source_node_id);
    const toId = nodeIdBySource.get(segment.to_source_node_id)
      ?? internalNodeId(input.namespace, segment.to_source_node_id);
    const fromCoordinate = coordinateBySource.get(segment.from_source_node_id) ?? [0, 0] as const;
    const toCoordinate = coordinateBySource.get(segment.to_source_node_id) ?? [0, 0] as const;
    const forwardGeometry = (segment.geometry_e7 ?? [fromCoordinate, toCoordinate]).map(cloneCoordinate);
    const common = {
      source_segment_id: segment.source_segment_id,
      hierarchy: segment.hierarchy,
      modes: [...segment.modes],
      length_mm: segment.length_mm,
      traversal_time_ms_by_mode: { ...segment.traversal_time_ms_by_mode },
    };

    if (segment.direction === "forward" || segment.direction === "both") {
      edges.push({
        id: internalEdgeId(input.namespace, segment.source_segment_id, "forward"),
        source_node_id: fromId,
        target_node_id: toId,
        ...common,
        geometry_e7: forwardGeometry,
      });
    }
    if (segment.direction === "backward" || segment.direction === "both") {
      edges.push({
        id: internalEdgeId(input.namespace, segment.source_segment_id, "reverse"),
        source_node_id: toId,
        target_node_id: fromId,
        ...common,
        geometry_e7: [...forwardGeometry].reverse(),
      });
    }
    if (!(["forward", "backward", "both"] as readonly string[]).includes(segment.direction)) {
      throw new GraphImportError(`unsupported segment direction: ${String(segment.direction)}`);
    }
  }

  const graph: RoadGraph = {
    format: GRAPH_FORMAT,
    schema_version: GRAPH_SCHEMA_VERSION,
    dataset: input.dataset,
    crs: {
      identifier: "EPSG:4326",
      axis_order: "longitude-latitude",
      coordinate_scale: COORDINATE_SCALE,
    },
    nodes,
    edges,
    turn_rules: [...(input.turn_rules ?? [])],
  };

  assertValidGraph(graph);
  return graph;
}
