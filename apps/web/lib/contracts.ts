export type WebTravelMode = "motor_vehicle" | "bicycle" | "pedestrian";
export type WebRoutingAlgorithm = "dijkstra" | "astar";

export interface EndpointView {
  readonly id: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly boundary_distance_m: number;
}

export interface LineFeature {
  readonly type: "Feature";
  readonly properties: Readonly<Record<string, string | number | readonly string[]>>;
  readonly geometry: { readonly type: "LineString"; readonly coordinates: Array<[number, number]> };
}

export interface FeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: LineFeature[];
}

export interface NetworkView {
  readonly status: "ready";
  readonly graph: {
    readonly dataset_version: string;
    readonly graph_sha256: string;
    readonly node_count: number;
    readonly edge_count: number;
    readonly turn_rule_count: number;
  };
  readonly mode: WebTravelMode;
  readonly network: FeatureCollection;
  readonly endpoints: readonly EndpointView[];
  readonly suggested_pair: { readonly start_node_id: string; readonly destination_node_id: string } | null;
  readonly attribution: string;
  readonly disclosure: string;
}

export interface RouteRequestView {
  readonly start_node_id: string;
  readonly destination_node_id: string;
  readonly mode: WebTravelMode;
  readonly algorithm: WebRoutingAlgorithm;
}

export interface RouteFoundView {
  readonly status: "found";
  readonly edge_path: readonly string[];
  readonly geometry: LineFeature;
  readonly cost_ms: number;
  readonly distance_mm: number;
  readonly algorithm: WebRoutingAlgorithm;
  readonly mode: WebTravelMode;
  readonly graph_sha256: string;
  readonly dataset_version: string;
  readonly boundary: {
    readonly status: "supported" | "boundary_sensitive";
    readonly minimum_boundary_distance_mm: number;
    readonly message: string;
  };
  readonly diagnostics: {
    readonly states_expanded: number;
    readonly queue_pushes: number;
    readonly server_compute_ms: number;
    readonly u_turn_policy: "source_rules_only";
  };
}

export interface RouteUnsupportedView {
  readonly status: "unsupported";
  readonly reason: "restriction_semantics";
  readonly message: string;
  readonly relation_ids: readonly number[];
  readonly categories: readonly string[];
  readonly graph_sha256: string;
  readonly dataset_version: string;
}

export interface RouteUnavailableView {
  readonly status: "unreachable" | "error";
  readonly message: string;
}

export type RouteResponseView = RouteFoundView | RouteUnsupportedView | RouteUnavailableView;
