import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RoutingIndex,
  graphSha256,
  importOsmOverpassRoadGraph,
  importRoadGraph,
  type GraphDatasetMetadata,
  type OsmRestrictionConcern,
  type RoadGraphImportInput,
  type RoutingSupportArtifact,
} from "../../../packages/graph/src/index.ts";
import { buildNetworkView, computeRouteView, type LoadedRoutingData } from "../lib/server/route-service.ts";

const corpusUrl = new URL("../../../tests/fixtures/routing/hand-audited.json", import.meta.url);

function dataFor(graph: ReturnType<typeof importRoadGraph>, concerns: readonly OsmRestrictionConcern[] = []): LoadedRoutingData {
  const support: RoutingSupportArtifact = {
    format: "vectorshift-routing-support",
    artifact_version: 1,
    graph_sha256: graphSha256(graph),
    source_sha256: graph.dataset.source.source_sha256,
    pipeline_version: graph.dataset.source.pipeline_version,
    u_turn_policy: "source_rules_only",
    concerns,
    restriction_audit: {
      relation_count: concerns.length,
      imported_relation_count: 0,
      partially_imported_relation_count: 0,
      generated_turn_rule_count: 0,
      concern_count: concerns.length,
      disposition_counts: {
        imported: 0, partially_imported_except: 0, unsupported_conditional: concerns.length,
        unsupported_mode_specific: 0, unsupported_except: 0, unsupported_via_way: 0,
        invalid_member_shape: 0, unsupported_restriction_value: 0, unresolved_way_or_direction: 0,
      },
      restriction_value_counts: {},
      relations: [],
    },
  };
  return { graph, support, index: new RoutingIndex(graph), graph_sha256: graphSha256(graph) };
}

test("route view follows ordered graph geometry and is deterministic", async () => {
  const corpus = JSON.parse(await readFile(corpusUrl, "utf8")) as { graph_input: RoadGraphImportInput };
  const graph = importRoadGraph(corpus.graph_input);
  const data = dataFor(graph);
  const request = { start_node_id: "node:routing-fixture:a", destination_node_id: "node:routing-fixture:d", mode: "motor_vehicle" as const, algorithm: "astar" as const };
  const first = computeRouteView(data, request);
  const second = computeRouteView(data, request);
  assert.equal(first.status, "found");
  assert.equal(second.status, "found");
  if (first.status !== "found" || second.status !== "found") return;
  assert.deepEqual(first.edge_path, second.edge_path);
  assert.deepEqual(first.geometry, second.geometry);
  assert.equal(first.geometry.geometry.coordinates[0]?.[0], -79.38);
  assert.equal(first.geometry.geometry.coordinates.at(-1)?.[0], -79.378);
  assert.equal(first.distance_mm, 2_000);
});

test("network view exposes actual eligible geometry and boundary-buffered endpoints", async () => {
  const corpus = JSON.parse(await readFile(corpusUrl, "utf8")) as { graph_input: RoadGraphImportInput };
  const graph = importRoadGraph(corpus.graph_input);
  const view = buildNetworkView(dataFor(graph), "motor_vehicle");
  assert.equal(view.network.features.length, graph.edges.filter((edge) => edge.modes.includes("motor_vehicle")).length);
  assert.ok(view.endpoints.every((endpoint) => endpoint.boundary_distance_m > 100));
  assert.equal(view.graph.graph_sha256, graphSha256(graph));
});

test("route responses classify boundary-sensitive paths without claiming completeness", async () => {
  const corpus = JSON.parse(await readFile(corpusUrl, "utf8")) as { graph_input: RoadGraphImportInput };
  const graphInput = structuredClone(corpus.graph_input) as RoadGraphImportInput;
  (graphInput.dataset.source.bounds as { west_e7: number }).west_e7 = -793800000;
  const graph = importRoadGraph(graphInput);
  const response = computeRouteView(dataFor(graph), {
    start_node_id: "node:routing-fixture:a",
    destination_node_id: "node:routing-fixture:d",
    mode: "motor_vehicle",
    algorithm: "dijkstra",
  });
  assert.equal(response.status, "found");
  if (response.status !== "found") return;
  assert.equal(response.boundary.status, "boundary_sensitive");
  assert.match(response.boundary.message, /omitted roads may change/);
});

const dataset: GraphDatasetMetadata = {
  dataset_id: "web-restriction-test",
  dataset_version: "1",
  source: {
    provider: "synthetic fixture", source_uri: "synthetic://web/restriction", license: "Apache-2.0", attribution: "VECTORSHIFT contributors",
    acquired_at: "2026-11-06T00:00:00Z", snapshot_at: "2026-11-06T00:00:00Z",
    bounds: { south_e7: 436400000, west_e7: -793900000, north_e7: 436700000, east_e7: -793500000 },
    source_sha256: "4444444444444444444444444444444444444444444444444444444444444444", pipeline_version: "synthetic/1",
  },
};

test("candidate routes affected by unresolved semantics are withheld with relation diagnostics", () => {
  const graph = importOsmOverpassRoadGraph({ elements: [
    { type: "node", id: 1, lon: -79.38, lat: 43.65 },
    { type: "node", id: 2, lon: -79.379, lat: 43.65 },
    { type: "node", id: 3, lon: -79.378, lat: 43.65 },
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary", oneway: "yes" } },
    { type: "way", id: 11, nodes: [2, 3], tags: { highway: "primary", oneway: "yes" } },
  ] }, dataset).graph;
  const concern: OsmRestrictionConcern = {
    relation_id: 99,
    category: "conditional_without_context",
    restriction: "no_left_turn @ (Mo-Fr 07:00-09:00)",
    affected_modes: ["motor_vehicle"],
    from_way_ids: [10], to_way_ids: [11], via_node_ids: [2], via_way_ids: [], except_values: [],
    message: "conditional restriction requires an evaluation context",
  };
  const response = computeRouteView(dataFor(graph, [concern]), {
    start_node_id: "node:osm:1", destination_node_id: "node:osm:3", mode: "motor_vehicle", algorithm: "dijkstra",
  });
  assert.deepEqual(response, {
    status: "unsupported",
    reason: "restriction_semantics",
    message: "The candidate path intersects OSM restriction semantics this graph version cannot evaluate safely. No route is presented.",
    relation_ids: [99], categories: ["conditional_without_context"], graph_sha256: graphSha256(graph), dataset_version: "1",
  });
});
