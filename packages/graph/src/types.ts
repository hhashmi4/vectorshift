export const GRAPH_FORMAT = "vectorshift-road-graph" as const;
export const GRAPH_SCHEMA_VERSION = 2 as const;
export const GRAPH_ARTIFACT_VERSION = 1 as const;
export const COORDINATE_SCALE = 10_000_000 as const;

export const ROAD_HIERARCHIES = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "service",
  "living_street",
  "path",
  "other",
] as const;

export const TRAVEL_MODES = ["motor_vehicle", "bicycle", "pedestrian"] as const;

export type RoadHierarchy = (typeof ROAD_HIERARCHIES)[number];
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type CoordinateE7 = readonly [longitude_e7: number, latitude_e7: number];
export type SegmentDirection = "forward" | "backward" | "both";

export interface GeographicBoundsE7 {
  readonly south_e7: number;
  readonly west_e7: number;
  readonly north_e7: number;
  readonly east_e7: number;
}

export interface GraphSourceMetadata {
  readonly provider: string;
  readonly source_uri: string;
  readonly license: string;
  readonly attribution: string;
  readonly acquired_at: string;
  readonly snapshot_at: string;
  readonly bounds: GeographicBoundsE7;
  readonly source_sha256: string;
  readonly pipeline_version: string;
}

export interface GraphDatasetMetadata {
  readonly dataset_id: string;
  readonly dataset_version: string;
  readonly source: GraphSourceMetadata;
}

export interface SourceReference {
  readonly namespace: string;
  readonly source_id: string;
}

export interface RoadNode {
  readonly id: string;
  readonly coordinate_e7: CoordinateE7;
  readonly source: SourceReference;
}

export interface DirectedRoadEdge {
  readonly id: string;
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly source_segment_id: string;
  readonly hierarchy: RoadHierarchy;
  readonly modes: readonly TravelMode[];
  readonly length_mm: number;
  readonly traversal_time_ms_by_mode: Readonly<Partial<Record<TravelMode, number>>>;
  readonly geometry_e7: readonly CoordinateE7[];
}

export interface ForbiddenTurnRule {
  readonly id: string;
  readonly via_node_id: string;
  readonly from_edge_id: string;
  readonly to_edge_id: string;
  readonly modes: readonly TravelMode[];
  readonly kind: "forbidden";
}

export interface PenalizedTurnRule {
  readonly id: string;
  readonly via_node_id: string;
  readonly from_edge_id: string;
  readonly to_edge_id: string;
  readonly modes: readonly TravelMode[];
  readonly kind: "penalty";
  readonly penalty_ms: number;
}

export type TurnRule = ForbiddenTurnRule | PenalizedTurnRule;

export interface RoadGraph {
  readonly format: typeof GRAPH_FORMAT;
  readonly schema_version: typeof GRAPH_SCHEMA_VERSION;
  readonly dataset: GraphDatasetMetadata;
  readonly crs: {
    readonly identifier: "EPSG:4326";
    readonly axis_order: "longitude-latitude";
    readonly coordinate_scale: typeof COORDINATE_SCALE;
  };
  readonly nodes: readonly RoadNode[];
  readonly edges: readonly DirectedRoadEdge[];
  readonly turn_rules: readonly TurnRule[];
}

export interface RoadGraphArtifact {
  readonly artifact_version: typeof GRAPH_ARTIFACT_VERSION;
  readonly graph_sha256: string;
  readonly graph: RoadGraph;
}

export interface GraphValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ImportNode {
  readonly source_node_id: string;
  readonly coordinate_e7: CoordinateE7;
}

export interface ImportRoadSegment {
  readonly source_segment_id: string;
  readonly from_source_node_id: string;
  readonly to_source_node_id: string;
  readonly direction: SegmentDirection;
  readonly hierarchy: RoadHierarchy;
  readonly modes: readonly TravelMode[];
  readonly length_mm: number;
  readonly traversal_time_ms_by_mode: Readonly<Partial<Record<TravelMode, number>>>;
  readonly geometry_e7?: readonly CoordinateE7[];
}

export interface RoadGraphImportInput {
  readonly namespace: string;
  readonly dataset: GraphDatasetMetadata;
  readonly nodes: readonly ImportNode[];
  readonly segments: readonly ImportRoadSegment[];
  readonly turn_rules?: readonly TurnRule[];
}

export interface GraphStatistics {
  readonly node_count: number;
  readonly directed_edge_count: number;
  readonly turn_rule_count: number;
  readonly weak_component_count: number;
  readonly weak_component_sizes: readonly number[];
  readonly isolated_node_count: number;
  readonly parallel_edge_group_count: number;
  readonly total_directed_length_mm: number;
  readonly edge_count_by_hierarchy: Readonly<Record<RoadHierarchy, number>>;
  readonly edge_count_by_mode: Readonly<Record<TravelMode, number>>;
}
