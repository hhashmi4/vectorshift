import { createHash } from "node:crypto";
import {
  GRAPH_ARTIFACT_VERSION,
  type CoordinateE7,
  type DirectedRoadEdge,
  type RoadGraph,
  type RoadGraphArtifact,
  type RoadNode,
  type TurnRule,
} from "./types.ts";
import { assertValidGraph } from "./validation.ts";

function compareId(left: { readonly id: string }, right: { readonly id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function coordinate(point: CoordinateE7): CoordinateE7 {
  return [point[0], point[1]];
}

export function normalizeRoadGraph(graph: RoadGraph): RoadGraph {
  assertValidGraph(graph);
  const nodes: RoadNode[] = graph.nodes.map((node) => ({
    id: node.id,
    coordinate_e7: coordinate(node.coordinate_e7),
    source: { namespace: node.source.namespace, source_id: node.source.source_id },
  })).sort(compareId);
  const edges: DirectedRoadEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source_node_id: edge.source_node_id,
    target_node_id: edge.target_node_id,
    source_segment_id: edge.source_segment_id,
    hierarchy: edge.hierarchy,
    modes: [...new Set(edge.modes)].sort(),
    length_mm: edge.length_mm,
    traversal_time_ms_by_mode: { ...edge.traversal_time_ms_by_mode },
    geometry_e7: edge.geometry_e7.map(coordinate),
  })).sort(compareId);
  const turnRules: TurnRule[] = graph.turn_rules.map((turn) => turn.kind === "penalty"
    ? { ...turn, modes: [...new Set(turn.modes)].sort(), penalty_ms: turn.penalty_ms }
    : { ...turn, modes: [...new Set(turn.modes)].sort() }).sort(compareId);

  return {
    format: graph.format,
    schema_version: graph.schema_version,
    dataset: {
      dataset_id: graph.dataset.dataset_id,
      dataset_version: graph.dataset.dataset_version,
      source: {
        ...graph.dataset.source,
        bounds: { ...graph.dataset.source.bounds },
      },
    },
    crs: { ...graph.crs },
    nodes,
    edges,
    turn_rules: turnRules,
  };
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => [key, stableJsonValue(child)]),
    );
  }
  return value;
}

export function canonicalGraphJson(graph: RoadGraph): string {
  return JSON.stringify(stableJsonValue(normalizeRoadGraph(graph)));
}

export function graphSha256(graph: RoadGraph): string {
  return createHash("sha256").update(canonicalGraphJson(graph), "utf8").digest("hex");
}

export function serializeRoadGraph(graph: RoadGraph): string {
  const normalized = normalizeRoadGraph(graph);
  const artifact: RoadGraphArtifact = {
    artifact_version: GRAPH_ARTIFACT_VERSION,
    graph_sha256: graphSha256(normalized),
    graph: normalized,
  };
  return `${JSON.stringify(stableJsonValue(artifact))}\n`;
}

export function deserializeRoadGraph(serialized: string | Uint8Array): RoadGraph {
  const source = typeof serialized === "string" ? serialized : new TextDecoder().decode(serialized);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`invalid road graph JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("invalid road graph artifact: expected an object");
  }
  const artifact = parsed as Record<string, unknown>;
  const allowed = new Set(["artifact_version", "graph_sha256", "graph"]);
  for (const key of Object.keys(artifact)) {
    if (!allowed.has(key)) throw new Error(`invalid road graph artifact: unknown property ${key}`);
  }
  if (artifact.artifact_version !== GRAPH_ARTIFACT_VERSION) {
    throw new Error(`unsupported road graph artifact version: ${String(artifact.artifact_version)}`);
  }
  if (typeof artifact.graph_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.graph_sha256)) {
    throw new Error("invalid road graph artifact digest");
  }
  assertValidGraph(artifact.graph);
  const actual = graphSha256(artifact.graph);
  if (actual !== artifact.graph_sha256) {
    throw new Error(`road graph integrity mismatch: expected ${artifact.graph_sha256}, calculated ${actual}`);
  }
  return normalizeRoadGraph(artifact.graph);
}
