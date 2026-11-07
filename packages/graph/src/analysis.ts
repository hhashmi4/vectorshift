import { TRAVEL_MODES, type GraphValidationIssue, type RoadGraph, type TravelMode } from "./types.ts";
import { assertValidGraph, validateRoadGraph } from "./validation.ts";

export interface GraphComponent {
  readonly id: number;
  readonly node_ids: readonly string[];
  readonly node_count: number;
  readonly eligible_edge_count: number;
  readonly touches_dataset_boundary: boolean;
}

export interface BoundaryDiagnostics {
  readonly tolerance_e7: number;
  readonly nodes_outside_declared_bounds: readonly string[];
  readonly nodes_near_boundary: readonly string[];
  readonly near_boundary_dead_end_nodes: readonly string[];
  readonly components_touching_boundary: readonly number[];
}

export interface GraphAnalysis {
  readonly mode: TravelMode | "all";
  readonly eligible_edge_ids: readonly string[];
  readonly ineligible_edge_ids: readonly string[];
  readonly isolated_node_ids: readonly string[];
  readonly weak_components: readonly GraphComponent[];
  readonly strong_components: readonly GraphComponent[];
  readonly boundary: BoundaryDiagnostics;
  readonly consistency_issues: readonly GraphValidationIssue[];
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedNeighbors(adjacency: ReadonlyMap<string, ReadonlySet<string>>, nodeId: string): string[] {
  return [...(adjacency.get(nodeId) ?? [])].sort(compare);
}

function components(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  reverseAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
  weak: boolean,
): string[][] {
  if (weak) {
    const seen = new Set<string>();
    const result: string[][] = [];
    for (const root of nodeIds) {
      if (seen.has(root)) continue;
      const members: string[] = [];
      const pending = [root];
      seen.add(root);
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === undefined) break;
        members.push(current);
        const neighbors = new Set([...sortedNeighbors(adjacency, current), ...sortedNeighbors(reverseAdjacency, current)]);
        for (const neighbor of [...neighbors].sort(compare).reverse()) {
          if (!seen.has(neighbor)) {
            seen.add(neighbor);
            pending.push(neighbor);
          }
        }
      }
      members.sort(compare);
      result.push(members);
    }
    return result.sort((left, right) => right.length - left.length || compare(left[0] ?? "", right[0] ?? ""));
  }

  const seen = new Set<string>();
  const finish: string[] = [];
  for (const root of nodeIds) {
    if (seen.has(root)) continue;
    const stack: Array<{ node: string; expanded: boolean }> = [{ node: root, expanded: false }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item === undefined) break;
      if (item.expanded) {
        finish.push(item.node);
        continue;
      }
      if (seen.has(item.node)) continue;
      seen.add(item.node);
      stack.push({ node: item.node, expanded: true });
      for (const neighbor of sortedNeighbors(adjacency, item.node).reverse()) {
        if (!seen.has(neighbor)) stack.push({ node: neighbor, expanded: false });
      }
    }
  }
  const assigned = new Set<string>();
  const result: string[][] = [];
  for (const root of finish.reverse()) {
    if (assigned.has(root)) continue;
    const members: string[] = [];
    const pending = [root];
    assigned.add(root);
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined) break;
      members.push(current);
      for (const neighbor of sortedNeighbors(reverseAdjacency, current).reverse()) {
        if (!assigned.has(neighbor)) {
          assigned.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    members.sort(compare);
    result.push(members);
  }
  return result.sort((left, right) => right.length - left.length || compare(left[0] ?? "", right[0] ?? ""));
}

export function isReachable(
  graph: RoadGraph,
  startNodeId: string,
  destinationNodeId: string,
  mode: TravelMode,
): boolean {
  assertValidGraph(graph);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId) || !nodeIds.has(destinationNodeId)) return false;
  if (startNodeId === destinationNodeId) return true;
  const outgoing = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    if (edge.modes.includes(mode)) outgoing.set(edge.source_node_id, [...(outgoing.get(edge.source_node_id) ?? []), edge]);
  }
  const forbidden = new Set(graph.turn_rules.filter((turn) => turn.kind === "forbidden" && turn.modes.includes(mode))
    .map((turn) => `${turn.from_edge_id}\u0000${turn.to_edge_id}`));
  const initial = [...(outgoing.get(startNodeId) ?? [])].sort((left, right) => compare(left.id, right.id));
  if (initial.some((edge) => edge.target_node_id === destinationNodeId)) return true;
  const seen = new Set(initial.map((edge) => edge.id));
  const pending = [...initial].reverse();
  while (pending.length > 0) {
    const incoming = pending.pop();
    if (incoming === undefined) break;
    const nextEdges = [...(outgoing.get(incoming.target_node_id) ?? [])].sort((left, right) => compare(left.id, right.id));
    for (const nextEdge of nextEdges) {
      if (forbidden.has(`${incoming.id}\u0000${nextEdge.id}`)) continue;
      if (nextEdge.target_node_id === destinationNodeId) return true;
      if (!seen.has(nextEdge.id)) {
        seen.add(nextEdge.id);
        pending.push(nextEdge);
      }
    }
  }
  return false;
}

export function analyzeRoadGraph(graph: RoadGraph, mode?: TravelMode, boundaryToleranceE7 = 100): GraphAnalysis {
  assertValidGraph(graph);
  if (mode !== undefined && !(TRAVEL_MODES as readonly string[]).includes(mode)) throw new TypeError(`unsupported travel mode: ${String(mode)}`);
  if (!Number.isSafeInteger(boundaryToleranceE7) || boundaryToleranceE7 < 0) throw new TypeError("boundary tolerance must be a non-negative safe integer");

  const nodeIds = graph.nodes.map((node) => node.id).sort(compare);
  const adjacency = new Map(nodeIds.map((id) => [id, new Set<string>()] as const));
  const reverse = new Map(nodeIds.map((id) => [id, new Set<string>()] as const));
  const eligible = graph.edges.filter((edge) => mode === undefined || edge.modes.includes(mode));
  for (const edge of eligible) {
    adjacency.get(edge.source_node_id)?.add(edge.target_node_id);
    reverse.get(edge.target_node_id)?.add(edge.source_node_id);
  }

  const degree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const edge of eligible) {
    degree.set(edge.source_node_id, (degree.get(edge.source_node_id) ?? 0) + 1);
    degree.set(edge.target_node_id, (degree.get(edge.target_node_id) ?? 0) + 1);
  }

  const bounds = graph.dataset.source.bounds;
  const outside: string[] = [];
  const near = new Set<string>();
  for (const node of graph.nodes) {
    const [longitude, latitude] = node.coordinate_e7;
    if (longitude < bounds.west_e7 || longitude > bounds.east_e7 || latitude < bounds.south_e7 || latitude > bounds.north_e7) outside.push(node.id);
    if (Math.abs(longitude - bounds.west_e7) <= boundaryToleranceE7
      || Math.abs(longitude - bounds.east_e7) <= boundaryToleranceE7
      || Math.abs(latitude - bounds.south_e7) <= boundaryToleranceE7
      || Math.abs(latitude - bounds.north_e7) <= boundaryToleranceE7) near.add(node.id);
  }
  outside.sort(compare);

  const toComponentRecords = (groups: readonly string[][]): GraphComponent[] => {
    const componentByNode = new Map<string, number>();
    groups.forEach((members, index) => members.forEach((nodeId) => componentByNode.set(nodeId, index)));
    const edgeCounts = new Uint32Array(groups.length);
    for (const edge of eligible) {
      const sourceComponent = componentByNode.get(edge.source_node_id);
      if (sourceComponent !== undefined && sourceComponent === componentByNode.get(edge.target_node_id)) {
        edgeCounts[sourceComponent] = (edgeCounts[sourceComponent] ?? 0) + 1;
      }
    }
    return groups.map((members, index) => ({
      id: index,
      node_ids: members,
      node_count: members.length,
      eligible_edge_count: edgeCounts[index] ?? 0,
      touches_dataset_boundary: members.some((id) => near.has(id)),
    }));
  };
  const weak = toComponentRecords(components(nodeIds, adjacency, reverse, true));
  const strong = toComponentRecords(components(nodeIds, adjacency, reverse, false));

  const consistencyIssues = [...validateRoadGraph(graph)];
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge] as const));
  for (let index = 0; index < graph.turn_rules.length; index += 1) {
    const turn = graph.turn_rules[index];
    if (turn === undefined) continue;
    const from = edgeById.get(turn.from_edge_id);
    const to = edgeById.get(turn.to_edge_id);
    for (const turnMode of turn.modes) {
      if (!from?.modes.includes(turnMode) || !to?.modes.includes(turnMode)) consistencyIssues.push({
        code: "turn_mode_not_traversable",
        path: `/turn_rules/${index}/modes`,
        message: `${turnMode} is not permitted on both transition edges`,
      });
    }
  }

  return {
    mode: mode ?? "all",
    eligible_edge_ids: eligible.map((edge) => edge.id).sort(compare),
    ineligible_edge_ids: graph.edges.filter((edge) => !eligible.includes(edge)).map((edge) => edge.id).sort(compare),
    isolated_node_ids: nodeIds.filter((id) => degree.get(id) === 0),
    weak_components: weak,
    strong_components: strong,
    boundary: {
      tolerance_e7: boundaryToleranceE7,
      nodes_outside_declared_bounds: outside,
      nodes_near_boundary: [...near].sort(compare),
      near_boundary_dead_end_nodes: [...near].filter((id) => (degree.get(id) ?? 0) <= 1).sort(compare),
      components_touching_boundary: weak.filter((component) => component.touches_dataset_boundary).map((component) => component.id),
    },
    consistency_issues: consistencyIssues.sort((left, right) => compare(left.path, right.path) || compare(left.code, right.code)),
  };
}
