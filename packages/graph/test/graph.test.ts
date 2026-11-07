import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  GraphValidationError,
  deserializeRoadGraph,
  graphStatistics,
  importRoadGraph,
  serializeRoadGraph,
  validateRoadGraph,
  type RoadGraph,
  type RoadGraphImportInput,
  type ImportRoadSegment,
} from "../src/index.ts";

const fixturePath = new URL("../../../tests/fixtures/graph/basic-network.input.json", import.meta.url);
const fixtureDigestPath = new URL("../../../tests/fixtures/graph/basic-network.expected.json", import.meta.url);

async function fixtureInput(): Promise<RoadGraphImportInput> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as RoadGraphImportInput;
}

function segmentAt(input: RoadGraphImportInput, index: number): ImportRoadSegment {
  const segment = input.segments[index];
  assert.ok(segment, `missing fixture segment ${index}`);
  return segment;
}

test("one-way segments create only the permitted directed edge", async () => {
  const input = await fixtureInput();
  const graph = importRoadGraph({ ...input, segments: input.segments.filter((segment) => segment.source_segment_id === "s2"), turn_rules: [] });
  assert.deepEqual(graph.edges.map((edge) => [edge.id, edge.source_node_id, edge.target_node_id]), [
    ["edge:synthetic:s2:forward", "node:synthetic:b", "node:synthetic:c"],
  ]);
});

test("bidirectional segments become two reversed directed edges", async () => {
  const input = await fixtureInput();
  const graph = importRoadGraph({ ...input, segments: input.segments.filter((segment) => segment.source_segment_id === "s1"), turn_rules: [] });
  assert.equal(graph.edges.length, 2);
  const forward = graph.edges.find((edge) => edge.id.endsWith(":forward"))!;
  const reverse = graph.edges.find((edge) => edge.id.endsWith(":reverse"))!;
  assert.deepEqual([forward.source_node_id, forward.target_node_id], [reverse.target_node_id, reverse.source_node_id]);
  assert.deepEqual(forward.geometry_e7, [...reverse.geometry_e7].reverse());
});

test("parallel directed edges are valid while duplicate IDs are rejected", async () => {
  const input = await fixtureInput();
  const graph = importRoadGraph(input);
  const parallel = graph.edges.filter((edge) => edge.source_node_id === "node:synthetic:b" && edge.target_node_id === "node:synthetic:c");
  assert.deepEqual(parallel.map((edge) => edge.id).sort(), ["edge:synthetic:s2:forward", "edge:synthetic:s3:forward"]);
  assert.throws(
    () => importRoadGraph({ ...input, segments: [...input.segments, segmentAt(input, 1)], turn_rules: [] }),
    (error) => error instanceof GraphValidationError && error.issues.some((item) => item.code === "duplicate_edge_id"),
  );
});

test("statistics identify disconnected components, isolation, and parallel groups", async () => {
  const graph = importRoadGraph(await fixtureInput());
  const statistics = graphStatistics(graph);
  assert.deepEqual(statistics, {
    node_count: 4,
    directed_edge_count: 4,
    turn_rule_count: 1,
    weak_component_count: 2,
    weak_component_sizes: [3, 1],
    isolated_node_count: 1,
    parallel_edge_group_count: 1,
    total_directed_length_mm: 450000,
    edge_count_by_hierarchy: {
      motorway: 0,
      trunk: 0,
      primary: 1,
      secondary: 0,
      tertiary: 0,
      residential: 2,
      service: 1,
      living_street: 0,
      path: 0,
      other: 0,
    },
    edge_count_by_mode: { motor_vehicle: 4, bicycle: 2, pedestrian: 0 },
  });
});

test("missing endpoints fail with a stable validation code", async () => {
  const input = await fixtureInput();
  assert.throws(
    () => importRoadGraph({ ...input, nodes: input.nodes.filter((node) => node.source_node_id !== "c"), turn_rules: [] }),
    (error) => error instanceof GraphValidationError
      && error.issues.some((item) => item.code === "missing_edge_target" && item.path.includes("target_node_id")),
  );
});

test("zero-length and invalid geometry are rejected", async () => {
  const graph = importRoadGraph(await fixtureInput());
  const corrupted = structuredClone(graph) as unknown as { edges: Array<Record<string, unknown>> };
  const firstCorruptedEdge = corrupted.edges[0];
  assert.ok(firstCorruptedEdge);
  firstCorruptedEdge.length_mm = 0;
  firstCorruptedEdge.geometry_e7 = [[-793800000, 436500000], [-793800000, 436500000]];
  const codes = new Set(validateRoadGraph(corrupted).map((item) => item.code));
  assert.ok(codes.has("invalid_positive_integer"));
  assert.ok(codes.has("zero_length_geometry"));
});

test("serialization is stable across input ordering and round trips", async () => {
  const input = await fixtureInput();
  const first = importRoadGraph(input);
  const second = importRoadGraph({
    ...input,
    nodes: [...input.nodes].reverse(),
    segments: [...input.segments].reverse(),
    turn_rules: [...(input.turn_rules ?? [])].reverse(),
  });
  const firstBytes = serializeRoadGraph(first);
  const secondBytes = serializeRoadGraph(second);
  assert.equal(firstBytes, secondBytes);
  assert.deepEqual(deserializeRoadGraph(firstBytes), deserializeRoadGraph(secondBytes));
});

test("canonical fixture matches the machine-independent golden digest", async () => {
  const expected = JSON.parse(await readFile(fixtureDigestPath, "utf8")) as {
    graph_sha256: string;
    artifact_sha256: string;
    artifact_bytes: number;
  };
  const serialized = serializeRoadGraph(importRoadGraph(await fixtureInput()));
  const artifact = JSON.parse(serialized) as { graph_sha256: string };
  assert.equal(artifact.graph_sha256, expected.graph_sha256);
  assert.equal(createHash("sha256").update(serialized).digest("hex"), expected.artifact_sha256);
  assert.equal(Buffer.byteLength(serialized), expected.artifact_bytes);
});

test("artifact corruption is detected by its digest", async () => {
  const serialized = serializeRoadGraph(importRoadGraph(await fixtureInput()));
  const artifact = JSON.parse(serialized) as { graph: { edges: Array<{ length_mm: number }> } };
  const firstArtifactEdge = artifact.graph.edges[0];
  assert.ok(firstArtifactEdge);
  firstArtifactEdge.length_mm += 1;
  assert.throws(() => deserializeRoadGraph(JSON.stringify(artifact)), /integrity mismatch/);
  assert.throws(() => deserializeRoadGraph("{not json"), /invalid road graph JSON/);
});

test("missing and invalid road properties produce explicit issues", async () => {
  const graph = importRoadGraph(await fixtureInput());
  const invalid = structuredClone(graph) as unknown as { edges: Array<Record<string, unknown>> };
  const firstInvalidEdge = invalid.edges[0];
  const secondInvalidEdge = invalid.edges[1];
  assert.ok(firstInvalidEdge && secondInvalidEdge);
  delete firstInvalidEdge.hierarchy;
  secondInvalidEdge.modes = [];
  secondInvalidEdge.traversal_time_ms_by_mode = { hovercraft: 1 };
  const issues = validateRoadGraph(invalid);
  assert.ok(issues.some((item) => item.code === "missing_property" && item.path.endsWith("/hierarchy")));
  assert.ok(issues.some((item) => item.code === "invalid_modes"));
  assert.ok(issues.some((item) => item.code === "unknown_property" && item.path.endsWith("/hovercraft")));
});

test("turn rules must join at their declared via node", async () => {
  const graph = importRoadGraph(await fixtureInput());
  const invalid = structuredClone(graph) as RoadGraph;
  const firstTurn = invalid.turn_rules[0];
  assert.ok(firstTurn);
  (firstTurn as unknown as { via_node_id: string }).via_node_id = "node:synthetic:a";
  const codes = validateRoadGraph(invalid).map((item) => item.code);
  assert.ok(codes.includes("invalid_turn_incoming"));
  assert.ok(codes.includes("invalid_turn_outgoing"));
});

test("property-style direction checks hold across deterministic generated segments", async () => {
  const base = await fixtureInput();
  let state = 0x5eed1234;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const direction = (["forward", "backward", "both"] as const)[next() % 3] ?? "forward";
    const segment: ImportRoadSegment = { ...segmentAt(base, 0), source_segment_id: `generated-${iteration}`, direction };
    const graph = importRoadGraph({ ...base, segments: [segment], turn_rules: [] });
    assert.equal(graph.edges.length, direction === "both" ? 2 : 1);
    const firstEdge = graph.edges[0];
    assert.ok(firstEdge);
    if (direction === "forward") assert.equal(firstEdge.source_node_id, "node:synthetic:a");
    if (direction === "backward") assert.equal(firstEdge.source_node_id, "node:synthetic:b");
  }
});
