import assert from "node:assert/strict";
import test from "node:test";
import {
  RoutingIndex,
  assessRestrictionSupport,
  dijkstra,
  importOsmOverpassRoadGraph,
  type GraphDatasetMetadata,
  type OsmRestrictionConcern,
} from "../src/index.ts";

const dataset: GraphDatasetMetadata = {
  dataset_id: "route-support-sequence-fixture",
  dataset_version: "1",
  source: {
    provider: "VECTORSHIFT synthetic fixture",
    source_uri: "synthetic://vectorshift/route-support-sequence/v1",
    license: "Apache-2.0",
    attribution: "VECTORSHIFT contributors",
    acquired_at: "2026-11-06T00:00:00Z",
    snapshot_at: "2026-11-06T00:00:00Z",
    bounds: { south_e7: 436400000, west_e7: -793900000, north_e7: 436700000, east_e7: -793500000 },
    source_sha256: "5555555555555555555555555555555555555555555555555555555555555555",
    pipeline_version: "synthetic/1",
  },
};

const imported = importOsmOverpassRoadGraph({ elements: [
  { type: "node", id: 1, lon: -79.38, lat: 43.65 },
  { type: "node", id: 2, lon: -79.379, lat: 43.65 },
  { type: "node", id: 3, lon: -79.378, lat: 43.65 },
  { type: "node", id: 4, lon: -79.377, lat: 43.65 },
  { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary", oneway: "yes" } },
  { type: "way", id: 20, nodes: [2, 3], tags: { highway: "primary", oneway: "yes" } },
  { type: "way", id: 30, nodes: [3, 4], tags: { highway: "primary", oneway: "yes" } },
] }, dataset);
const route = dijkstra(new RoutingIndex(imported.graph), { start_node_id: "node:osm:1", destination_node_id: "node:osm:4", mode: "motor_vehicle" });
assert.equal(route.status, "found");

test("via-way concerns match the ordered source-way sequence and affected mode", () => {
  if (route.status !== "found") return;
  const concern: OsmRestrictionConcern = {
    relation_id: 100,
    category: "via_way_sequence_unsupported",
    restriction: "no_straight_on",
    affected_modes: ["motor_vehicle"],
    from_way_ids: [10],
    to_way_ids: [30],
    via_node_ids: [],
    via_way_ids: [20],
    except_values: [],
    message: "via-way sequence requires route-history state",
  };
  const assessment = assessRestrictionSupport(imported.graph, route, "motor_vehicle", [concern]);
  assert.equal(assessment.status, "unsupported");
  assert.deepEqual(assessment.matched_concerns.map((item) => item.relation_id), [100]);
  assert.equal(assessRestrictionSupport(imported.graph, route, "bicycle", [concern]).status, "supported");
});

test("a non-matching via-way exit is not falsely classified as affected", () => {
  if (route.status !== "found") return;
  const concern: OsmRestrictionConcern = {
    relation_id: 101,
    category: "via_way_sequence_unsupported",
    restriction: "no_right_turn",
    affected_modes: ["motor_vehicle"],
    from_way_ids: [10],
    to_way_ids: [999],
    via_node_ids: [],
    via_way_ids: [20],
    except_values: [],
    message: "different exit",
  };
  assert.equal(assessRestrictionSupport(imported.graph, route, "motor_vehicle", [concern]).status, "supported");
});
