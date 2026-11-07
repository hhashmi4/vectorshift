import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RoutingIndex,
  RoutingInputError,
  aStar,
  analyzeRoadGraph,
  dijkstra,
  importRoadGraph,
  isReachable,
  serializeRoadGraph,
  type RoadGraph,
  type RoadGraphImportInput,
  type RouteQuery,
  type TravelMode,
} from "../src/index.ts";

interface CorpusQuery {
  readonly name: string;
  readonly start: string;
  readonly destination: string;
  readonly mode: TravelMode;
  readonly status: "found" | "unreachable";
  readonly cost_ms: number | null;
  readonly edge_path: readonly string[];
}

interface Corpus {
  readonly graph_input: RoadGraphImportInput;
  readonly queries: readonly CorpusQuery[];
}

const corpusUrl = new URL("../../../tests/fixtures/routing/hand-audited.json", import.meta.url);

async function loadCorpus(): Promise<{ graph: RoadGraph; queries: readonly CorpusQuery[] }> {
  const corpus = JSON.parse(await readFile(corpusUrl, "utf8")) as Corpus;
  return { graph: importRoadGraph(corpus.graph_input), queries: corpus.queries };
}

function assertLegalPath(graph: RoadGraph, query: RouteQuery, edgePath: readonly string[], expectedCost: number): void {
  const byId = new Map(graph.edges.map((edge) => [edge.id, edge] as const));
  const turns = new Map(graph.turn_rules.flatMap((turn) => turn.modes.map((mode) => [`${turn.from_edge_id}\u0000${turn.to_edge_id}\u0000${mode}`, turn] as const)));
  let node = query.start_node_id;
  let incoming: string | undefined;
  let cost = 0;
  for (const edgeId of edgePath) {
    const edge = byId.get(edgeId);
    assert.ok(edge, `unknown path edge ${edgeId}`);
    assert.equal(edge.source_node_id, node, "path must be topologically contiguous");
    assert.ok(edge.modes.includes(query.mode), `${query.mode} must be permitted on ${edgeId}`);
    const edgeCost = edge.traversal_time_ms_by_mode[query.mode];
    assert.notEqual(edgeCost, undefined);
    if (incoming !== undefined) {
      const turn = turns.get(`${incoming}\u0000${edgeId}\u0000${query.mode}`);
      assert.notEqual(turn?.kind, "forbidden", "path must not traverse a forbidden turn");
      if (turn?.kind === "penalty") cost += turn.penalty_ms;
    }
    cost += edgeCost ?? 0;
    incoming = edgeId;
    node = edge.target_node_id;
  }
  assert.equal(node, query.destination_node_id);
  assert.equal(cost, expectedCost);
}

test("hand-audited corpus is independently satisfied by Dijkstra and A*", async () => {
  const { graph, queries } = await loadCorpus();
  const index = new RoutingIndex(graph);
  for (const item of queries) {
    const query: RouteQuery = {
      start_node_id: `node:routing-fixture:${item.start}`,
      destination_node_id: `node:routing-fixture:${item.destination}`,
      mode: item.mode,
    };
    for (const result of [dijkstra(index, query), aStar(index, query)]) {
      assert.equal(result.status, item.status, item.name);
      assert.equal(result.cost_ms, item.cost_ms, item.name);
      assert.deepEqual(result.edge_path, item.edge_path, item.name);
      if (result.status === "found") assertLegalPath(graph, query, result.edge_path, result.cost_ms);
    }
  }
});

test("graph analysis reports directionality, components, isolation, and mode eligibility", async () => {
  const { graph } = await loadCorpus();
  const analysis = analyzeRoadGraph(graph, "motor_vehicle");
  assert.deepEqual(analysis.weak_components.map((component) => component.node_count), [5, 4, 1, 1, 1]);
  assert.ok(analysis.strong_components.every((component) => component.node_count === 1));
  assert.deepEqual(analysis.isolated_node_ids, ["node:routing-fixture:x", "node:routing-fixture:y", "node:routing-fixture:z"]);
  assert.equal(isReachable(graph, "node:routing-fixture:a", "node:routing-fixture:d", "motor_vehicle"), true);
  assert.equal(isReachable(graph, "node:routing-fixture:d", "node:routing-fixture:a", "motor_vehicle"), false);
  const turnCutGraph: RoadGraph = {
    ...graph,
    nodes: graph.nodes.filter((node) => ["node:routing-fixture:b", "node:routing-fixture:c", "node:routing-fixture:d"].includes(node.id)),
    edges: graph.edges.filter((edge) => ["edge:routing-fixture:cb:forward", "edge:routing-fixture:bd-fast:forward"].includes(edge.id)),
    turn_rules: graph.turn_rules.filter((turn) => turn.id === "turn:cb-to-bd-fast"),
  };
  assert.equal(isReachable(turnCutGraph, "node:routing-fixture:c", "node:routing-fixture:d", "motor_vehicle"), false);
  assert.deepEqual(analysis.consistency_issues, []);
});

function independentBellmanFord(graph: RoadGraph, query: RouteQuery): number | null {
  if (query.start_node_id === query.destination_node_id) return 0;
  const eligible = graph.edges.filter((edge) => edge.modes.includes(query.mode));
  const distance = new Map<string, number>();
  const turnByTransition = new Map(graph.turn_rules.flatMap((turn) => turn.modes.includes(query.mode)
    ? [[`${turn.from_edge_id}\u0000${turn.to_edge_id}`, turn] as const]
    : []));
  for (const edge of eligible) {
    if (edge.source_node_id === query.start_node_id) distance.set(edge.id, edge.traversal_time_ms_by_mode[query.mode] ?? Number.POSITIVE_INFINITY);
  }
  for (let pass = 0; pass < eligible.length; pass += 1) {
    let changed = false;
    for (const incoming of eligible) {
      const base = distance.get(incoming.id);
      if (base === undefined) continue;
      for (const outgoing of eligible) {
        if (incoming.target_node_id !== outgoing.source_node_id) continue;
        const turn = turnByTransition.get(`${incoming.id}\u0000${outgoing.id}`);
        if (turn?.kind === "forbidden") continue;
        const candidate = base + (outgoing.traversal_time_ms_by_mode[query.mode] ?? Number.POSITIVE_INFINITY)
          + (turn?.kind === "penalty" ? turn.penalty_ms : 0);
        if (candidate < (distance.get(outgoing.id) ?? Number.POSITIVE_INFINITY)) {
          distance.set(outgoing.id, candidate);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const goals = eligible.filter((edge) => edge.target_node_id === query.destination_node_id).map((edge) => distance.get(edge.id) ?? Number.POSITIVE_INFINITY);
  const best = Math.min(...goals);
  return Number.isFinite(best) ? best : null;
}

function randomGraph(seed: number): RoadGraph {
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const nodes = Array.from({ length: 7 }, (_, index) => ({ source_node_id: `n${index}`, coordinate_e7: [-793800000 + index * 1000, 436500000 + (index % 2) * 1000] as const }));
  const segments: RoadGraphImportInput["segments"][number][] = [];
  for (let from = 0; from < nodes.length; from += 1) {
    for (let to = 0; to < nodes.length; to += 1) {
      if (from === to || next() % 5 !== 0) continue;
      segments.push({
        source_segment_id: `e${from}-${to}`,
        from_source_node_id: `n${from}`,
        to_source_node_id: `n${to}`,
        direction: "forward",
        hierarchy: "residential",
        modes: ["motor_vehicle"],
        length_mm: 1000 + next() % 1000,
        traversal_time_ms_by_mode: { motor_vehicle: next() % 11 },
      });
    }
  }
  return importRoadGraph({
    namespace: `random-${seed}`,
    dataset: {
      dataset_id: `random-${seed}`,
      dataset_version: "1",
      source: {
        provider: "deterministic test generator",
        source_uri: `synthetic://random/${seed}`,
        license: "Apache-2.0",
        attribution: "VECTORSHIFT contributors",
        acquired_at: "2026-11-06T00:00:00Z",
        snapshot_at: "2026-11-06T00:00:00Z",
        bounds: { south_e7: 436400000, west_e7: -793900000, north_e7: 436700000, east_e7: -793500000 },
        source_sha256: seed.toString(16).padStart(64, "0"),
        pipeline_version: "random-test/1",
      },
    },
    nodes,
    segments,
    turn_rules: [],
  });
}

test("fixed-seed randomized graphs agree with an independent Bellman-Ford state oracle", () => {
  for (let seed = 1; seed <= 80; seed += 1) {
    const graph = randomGraph(seed);
    const index = new RoutingIndex(graph);
    const query: RouteQuery = {
      start_node_id: `node:random-${seed}:n0`,
      destination_node_id: `node:random-${seed}:n6`,
      mode: "motor_vehicle",
    };
    const expected = independentBellmanFord(graph, query);
    for (const result of [dijkstra(index, query), aStar(index, query)]) {
      assert.equal(result.cost_ms, expected, `seed ${seed}`);
      if (result.status === "found") assertLegalPath(graph, query, result.edge_path, result.cost_ms);
    }
  }
});

test("increasing one edge cost cannot improve a fixed optimal route", async () => {
  const { graph } = await loadCorpus();
  const query: RouteQuery = { start_node_id: "node:routing-fixture:a", destination_node_id: "node:routing-fixture:d", mode: "motor_vehicle" };
  const before = dijkstra(new RoutingIndex(graph), query);
  assert.equal(before.status, "found");
  const changed = structuredClone(graph) as RoadGraph;
  const edge = changed.edges.find((candidate) => candidate.id === "edge:routing-fixture:ab:forward");
  assert.ok(edge);
  (edge.traversal_time_ms_by_mode as { motor_vehicle: number }).motor_vehicle += 100;
  const after = dijkstra(new RoutingIndex(changed), query);
  assert.equal(after.status, "found");
  assert.ok(after.cost_ms >= before.cost_ms);
});

test("routing rejects invalid inputs and never mutates the source graph", async () => {
  const { graph } = await loadCorpus();
  const before = serializeRoadGraph(graph);
  const index = new RoutingIndex(graph);
  assert.throws(
    () => dijkstra(index, { start_node_id: "node:routing-fixture:missing", destination_node_id: "node:routing-fixture:d", mode: "motor_vehicle" }),
    (error) => error instanceof RoutingInputError && error.code === "unknown_start_node",
  );
  assert.throws(
    () => index.route({ start_node_id: "node:routing-fixture:a", destination_node_id: "node:routing-fixture:d", mode: "hovercraft" as TravelMode }, "astar"),
    (error) => error instanceof RoutingInputError && error.code === "unsupported_mode",
  );
  dijkstra(index, { start_node_id: "node:routing-fixture:a", destination_node_id: "node:routing-fixture:d", mode: "motor_vehicle" });
  assert.equal(serializeRoadGraph(graph), before);
});
