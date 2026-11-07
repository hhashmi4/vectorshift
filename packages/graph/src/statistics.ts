import {
  ROAD_HIERARCHIES,
  TRAVEL_MODES,
  type GraphStatistics,
  type RoadGraph,
  type RoadHierarchy,
  type TravelMode,
} from "./types.ts";
import { assertValidGraph } from "./validation.ts";

export function graphStatistics(graph: RoadGraph): GraphStatistics {
  assertValidGraph(graph);
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()] as const));
  const parallel = new Map<string, number>();
  const hierarchy = Object.fromEntries(ROAD_HIERARCHIES.map((value) => [value, 0])) as Record<RoadHierarchy, number>;
  const mode = Object.fromEntries(TRAVEL_MODES.map((value) => [value, 0])) as Record<TravelMode, number>;
  let totalLength = 0;

  for (const edge of graph.edges) {
    adjacency.get(edge.source_node_id)!.add(edge.target_node_id);
    adjacency.get(edge.target_node_id)!.add(edge.source_node_id);
    const pair = `${edge.source_node_id}\u0000${edge.target_node_id}`;
    parallel.set(pair, (parallel.get(pair) ?? 0) + 1);
    hierarchy[edge.hierarchy] += 1;
    edge.modes.forEach((value) => { mode[value] += 1; });
    totalLength += edge.length_mm;
    if (!Number.isSafeInteger(totalLength)) throw new Error("total directed length exceeds safe integer range");
  }

  const visited = new Set<string>();
  const componentSizes: number[] = [];
  for (const nodeId of [...adjacency.keys()].sort()) {
    if (visited.has(nodeId)) continue;
    let size = 0;
    const pending = [nodeId];
    visited.add(nodeId);
    while (pending.length > 0) {
      const current = pending.pop()!;
      size += 1;
      for (const neighbor of [...adjacency.get(current)!].sort().reverse()) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    componentSizes.push(size);
  }
  componentSizes.sort((left, right) => right - left);

  return {
    node_count: graph.nodes.length,
    directed_edge_count: graph.edges.length,
    turn_rule_count: graph.turn_rules.length,
    weak_component_count: componentSizes.length,
    weak_component_sizes: componentSizes,
    isolated_node_count: [...adjacency.values()].filter((neighbors) => neighbors.size === 0).length,
    parallel_edge_group_count: [...parallel.values()].filter((count) => count > 1).length,
    total_directed_length_mm: totalLength,
    edge_count_by_hierarchy: hierarchy,
    edge_count_by_mode: mode,
  };
}
