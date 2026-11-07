import { graphSha256 } from "./serialization.ts";
import { TRAVEL_MODES, type CoordinateE7, type DirectedRoadEdge, type RoadGraph, type TravelMode } from "./types.ts";
import { assertValidGraph } from "./validation.ts";

export type RoutingAlgorithm = "dijkstra" | "astar";

export interface RouteQuery {
  readonly start_node_id: string;
  readonly destination_node_id: string;
  readonly mode: TravelMode;
}

export interface RouteProvenance {
  readonly graph_sha256: string;
  readonly dataset_id: string;
  readonly dataset_version: string;
  readonly graph_schema_version: number;
  readonly algorithm: RoutingAlgorithm;
  readonly mode: TravelMode;
  readonly cost_model: "traversal_time_ms_plus_turn_penalty_ms";
}

export interface RouteDiagnostics {
  readonly states_expanded: number;
  readonly edges_considered: number;
  readonly queue_pushes: number;
  readonly queue_pops: number;
  readonly stale_queue_pops: number;
  readonly relaxations: number;
  readonly forbidden_turns_skipped: number;
  readonly mode_ineligible_edges_skipped: number;
  readonly heuristic: "zero" | "straight_line_conservative_speed_bound";
  readonly maximum_straight_line_speed_mm_per_ms: number | null;
}

export interface FoundRoute {
  readonly status: "found";
  readonly edge_path: readonly string[];
  readonly node_path: readonly string[];
  readonly cost_ms: number;
  readonly provenance: RouteProvenance;
  readonly diagnostics: RouteDiagnostics;
}

export interface UnreachableRoute {
  readonly status: "unreachable";
  readonly edge_path: readonly [];
  readonly node_path: readonly [];
  readonly cost_ms: null;
  readonly provenance: RouteProvenance;
  readonly diagnostics: RouteDiagnostics;
}

export type RouteResult = FoundRoute | UnreachableRoute;

export type RoutingInputErrorCode = "unknown_start_node" | "unknown_destination_node" | "unsupported_mode";

export class RoutingInputError extends Error {
  readonly code: RoutingInputErrorCode;

  constructor(code: RoutingInputErrorCode, message: string) {
    super(message);
    this.name = "RoutingInputError";
    this.code = code;
  }
}

interface QueueEntry {
  readonly state: number;
  readonly g: number;
  readonly f: number;
  readonly tie: string;
}

class MinHeap {
  readonly #items: QueueEntry[] = [];

  get size(): number { return this.#items.length; }

  #less(left: QueueEntry, right: QueueEntry): boolean {
    return left.f < right.f
      || (left.f === right.f && (left.g < right.g || (left.g === right.g && left.tie < right.tie)));
  }

  push(item: QueueEntry): void {
    let index = this.#items.length;
    this.#items.push(item);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentItem = this.#items[parent];
      if (parentItem === undefined || !this.#less(item, parentItem)) break;
      this.#items[index] = parentItem;
      index = parent;
    }
    this.#items[index] = item;
  }

  pop(): QueueEntry | undefined {
    const root = this.#items[0];
    const last = this.#items.pop();
    if (root === undefined || last === undefined || this.#items.length === 0) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.#items.length) break;
      let child = left;
      const leftItem = this.#items[left];
      const rightItem = this.#items[right];
      if (leftItem === undefined) break;
      if (rightItem !== undefined && this.#less(rightItem, leftItem)) child = right;
      const childItem = this.#items[child];
      if (childItem === undefined || !this.#less(childItem, last)) break;
      this.#items[index] = childItem;
      index = child;
    }
    this.#items[index] = last;
    return root;
  }
}

interface TurnDecision {
  readonly forbidden: boolean;
  readonly penalty_ms: number;
}

interface SearchCounters {
  states_expanded: number;
  edges_considered: number;
  queue_pushes: number;
  queue_pops: number;
  stale_queue_pops: number;
  relaxations: number;
  forbidden_turns_skipped: number;
  mode_ineligible_edges_skipped: number;
}

function haversineMm(left: CoordinateE7, right: CoordinateE7): number {
  const radians = Math.PI / 180;
  const latitude1 = left[1] / 10_000_000 * radians;
  const latitude2 = right[1] / 10_000_000 * radians;
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = (right[0] - left[0]) / 10_000_000 * radians;
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const a = Math.min(1, Math.max(0, sinLatitude ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * sinLongitude ** 2));
  return 6_371_008_800 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class RoutingIndex {
  readonly #nodes: ReadonlyMap<string, CoordinateE7>;
  readonly #edges: readonly DirectedRoadEdge[];
  readonly #edgeIndexById: ReadonlyMap<string, number>;
  readonly #outgoing: ReadonlyMap<string, readonly number[]>;
  readonly #turns: ReadonlyMap<string, TurnDecision>;
  readonly #graphSha256: string;
  readonly #datasetId: string;
  readonly #datasetVersion: string;
  readonly #schemaVersion: number;
  readonly #speedBounds = new Map<TravelMode, number | null>();

  constructor(graph: RoadGraph) {
    assertValidGraph(graph);
    this.#nodes = new Map(graph.nodes.map((node) => [node.id, [node.coordinate_e7[0], node.coordinate_e7[1]] as CoordinateE7]));
    this.#edges = [...graph.edges].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0).map((edge) => ({
      ...edge,
      modes: [...edge.modes],
      traversal_time_ms_by_mode: { ...edge.traversal_time_ms_by_mode },
      geometry_e7: edge.geometry_e7.map((point) => [point[0], point[1]] as CoordinateE7),
    }));
    this.#edgeIndexById = new Map(this.#edges.map((edge, index) => [edge.id, index]));
    const outgoing = new Map<string, number[]>();
    for (let index = 0; index < this.#edges.length; index += 1) {
      const edge = this.#edges[index];
      if (edge !== undefined) outgoing.set(edge.source_node_id, [...(outgoing.get(edge.source_node_id) ?? []), index]);
    }
    this.#outgoing = outgoing;
    const turns = new Map<string, TurnDecision>();
    for (const turn of graph.turn_rules) {
      for (const mode of turn.modes) turns.set(`${turn.from_edge_id}\u0000${turn.to_edge_id}\u0000${mode}`, {
        forbidden: turn.kind === "forbidden",
        penalty_ms: turn.kind === "penalty" ? turn.penalty_ms : 0,
      });
    }
    this.#turns = turns;
    this.#graphSha256 = graphSha256(graph);
    this.#datasetId = graph.dataset.dataset_id;
    this.#datasetVersion = graph.dataset.dataset_version;
    this.#schemaVersion = graph.schema_version;
  }

  #speedBound(mode: TravelMode): number | null {
    if (this.#speedBounds.has(mode)) return this.#speedBounds.get(mode) ?? null;
    let maximum = 0;
    for (const edge of this.#edges) {
      const cost = edge.traversal_time_ms_by_mode[mode];
      if (!edge.modes.includes(mode) || cost === undefined) continue;
      const source = this.#nodes.get(edge.source_node_id);
      const target = this.#nodes.get(edge.target_node_id);
      if (source === undefined || target === undefined) continue;
      const distance = haversineMm(source, target);
      if (cost === 0 && distance > 0) {
        this.#speedBounds.set(mode, null);
        return null;
      }
      if (cost > 0) maximum = Math.max(maximum, distance / cost);
    }
    const bound = maximum > 0 ? maximum * (1 + 1e-12) : null;
    this.#speedBounds.set(mode, bound);
    return bound;
  }

  route(query: RouteQuery, algorithm: RoutingAlgorithm): RouteResult {
    if (!this.#nodes.has(query.start_node_id)) throw new RoutingInputError("unknown_start_node", `unknown start node: ${query.start_node_id}`);
    if (!this.#nodes.has(query.destination_node_id)) throw new RoutingInputError("unknown_destination_node", `unknown destination node: ${query.destination_node_id}`);
    if (!(TRAVEL_MODES as readonly string[]).includes(query.mode)) throw new RoutingInputError("unsupported_mode", `unsupported travel mode: ${String(query.mode)}`);

    const speedBound = algorithm === "astar" ? this.#speedBound(query.mode) : null;
    const heuristicName = algorithm === "astar" && speedBound !== null
      ? "straight_line_conservative_speed_bound" as const
      : "zero" as const;
    const provenance: RouteProvenance = {
      graph_sha256: this.#graphSha256,
      dataset_id: this.#datasetId,
      dataset_version: this.#datasetVersion,
      graph_schema_version: this.#schemaVersion,
      algorithm,
      mode: query.mode,
      cost_model: "traversal_time_ms_plus_turn_penalty_ms",
    };
    const counters: SearchCounters = {
      states_expanded: 0,
      edges_considered: 0,
      queue_pushes: 0,
      queue_pops: 0,
      stale_queue_pops: 0,
      relaxations: 0,
      forbidden_turns_skipped: 0,
      mode_ineligible_edges_skipped: 0,
    };
    const diagnostics = (): RouteDiagnostics => ({
      ...counters,
      heuristic: heuristicName,
      maximum_straight_line_speed_mm_per_ms: speedBound,
    });
    if (query.start_node_id === query.destination_node_id) return {
      status: "found",
      edge_path: [],
      node_path: [query.start_node_id],
      cost_ms: 0,
      provenance,
      diagnostics: diagnostics(),
    };

    const destinationCoordinate = this.#nodes.get(query.destination_node_id);
    const heuristic = (nodeId: string): number => {
      if (speedBound === null || destinationCoordinate === undefined) return 0;
      const point = this.#nodes.get(nodeId);
      return point === undefined ? 0 : Math.floor(haversineMm(point, destinationCoordinate) / speedBound);
    };
    const distances = new Float64Array(this.#edges.length);
    distances.fill(Number.POSITIVE_INFINITY);
    const predecessor = new Int32Array(this.#edges.length);
    predecessor.fill(-1);
    const queue = new MinHeap();

    const seed = this.#outgoing.get(query.start_node_id) ?? [];
    for (const edgeIndex of seed) {
      const edge = this.#edges[edgeIndex];
      if (edge === undefined) continue;
      counters.edges_considered += 1;
      const cost = edge.traversal_time_ms_by_mode[query.mode];
      if (!edge.modes.includes(query.mode) || cost === undefined) {
        counters.mode_ineligible_edges_skipped += 1;
        continue;
      }
      if (cost < (distances[edgeIndex] ?? Number.POSITIVE_INFINITY)) {
        distances[edgeIndex] = cost;
        queue.push({ state: edgeIndex, g: cost, f: cost + heuristic(edge.target_node_id), tie: edge.id });
        counters.queue_pushes += 1;
        counters.relaxations += 1;
      }
    }

    let goalState = -1;
    while (queue.size > 0) {
      const current = queue.pop();
      if (current === undefined) break;
      counters.queue_pops += 1;
      if (current.g !== distances[current.state]) {
        counters.stale_queue_pops += 1;
        continue;
      }
      const incoming = this.#edges[current.state];
      if (incoming === undefined) continue;
      counters.states_expanded += 1;
      if (incoming.target_node_id === query.destination_node_id) {
        goalState = current.state;
        break;
      }
      for (const nextState of this.#outgoing.get(incoming.target_node_id) ?? []) {
        const outgoing = this.#edges[nextState];
        if (outgoing === undefined) continue;
        counters.edges_considered += 1;
        const edgeCost = outgoing.traversal_time_ms_by_mode[query.mode];
        if (!outgoing.modes.includes(query.mode) || edgeCost === undefined) {
          counters.mode_ineligible_edges_skipped += 1;
          continue;
        }
        const turn = this.#turns.get(`${incoming.id}\u0000${outgoing.id}\u0000${query.mode}`);
        if (turn?.forbidden === true) {
          counters.forbidden_turns_skipped += 1;
          continue;
        }
        const candidate = current.g + edgeCost + (turn?.penalty_ms ?? 0);
        if (!Number.isSafeInteger(candidate)) throw new RangeError("route cost exceeds the safe integer range");
        if (candidate < (distances[nextState] ?? Number.POSITIVE_INFINITY)) {
          distances[nextState] = candidate;
          predecessor[nextState] = current.state;
          queue.push({ state: nextState, g: candidate, f: candidate + heuristic(outgoing.target_node_id), tie: outgoing.id });
          counters.queue_pushes += 1;
          counters.relaxations += 1;
        }
      }
    }

    if (goalState < 0) return {
      status: "unreachable",
      edge_path: [],
      node_path: [],
      cost_ms: null,
      provenance,
      diagnostics: diagnostics(),
    };
    const reversed: number[] = [];
    for (let state = goalState; state >= 0; state = predecessor[state] ?? -1) reversed.push(state);
    reversed.reverse();
    const edgePath = reversed.map((state) => this.#edges[state]?.id).filter((id): id is string => id !== undefined);
    const nodePath = [query.start_node_id, ...reversed.map((state) => this.#edges[state]?.target_node_id).filter((id): id is string => id !== undefined)];
    return {
      status: "found",
      edge_path: edgePath,
      node_path: nodePath,
      cost_ms: distances[goalState] ?? Number.POSITIVE_INFINITY,
      provenance,
      diagnostics: diagnostics(),
    };
  }
}

export function dijkstra(index: RoutingIndex, query: RouteQuery): RouteResult {
  return index.route(query, "dijkstra");
}

export function aStar(index: RoutingIndex, query: RouteQuery): RouteResult {
  return index.route(query, "astar");
}
