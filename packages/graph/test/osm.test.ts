import assert from "node:assert/strict";
import test from "node:test";
import {
  GraphImportError,
  importOsmOverpassRoadGraph,
  type GraphDatasetMetadata,
  type OsmOverpassDocument,
} from "../src/index.ts";

const dataset: GraphDatasetMetadata = {
  dataset_id: "synthetic-osm-adapter",
  dataset_version: "1",
  source: {
    provider: "synthetic OSM adapter fixture",
    source_uri: "synthetic://vectorshift/osm-adapter/v1",
    license: "Apache-2.0",
    attribution: "VECTORSHIFT contributors",
    acquired_at: "2026-11-06T00:00:00Z",
    snapshot_at: "2026-11-06T00:00:00Z",
    bounds: { south_e7: 436400000, west_e7: -793900000, north_e7: 436600000, east_e7: -793600000 },
    source_sha256: "33b2a1f79683e077b4f6a095a13b555933149f149bc26cfc1afb1e1c96bd608d",
    pipeline_version: "osm-road-graph/1",
  },
};

const baseElements: OsmOverpassDocument["elements"] = [
  { type: "node", id: 1, lon: -79.38, lat: 43.65 },
  { type: "node", id: 2, lon: -79.379, lat: 43.65 },
  { type: "node", id: 3, lon: -79.378, lat: 43.65 },
];

test("OSM basic one-way, reverse one-way, and bidirectional rules are explicit", () => {
  const document: OsmOverpassDocument = {
    elements: [
      ...baseElements,
      { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary", oneway: "yes", maxspeed: "40" } },
      { type: "way", id: 11, nodes: [2, 3], tags: { highway: "service", oneway: "-1" } },
      { type: "way", id: 12, nodes: [1, 3], tags: { highway: "residential" } },
    ],
  };
  const result = importOsmOverpassRoadGraph(document, dataset);
  const way10 = result.graph.edges.filter((edge) => edge.id.includes("way%3A10"));
  assert.equal(way10.length, 3);
  const vehicleForward = way10.find((edge) => edge.modes.includes("motor_vehicle"));
  assert.ok(vehicleForward);
  assert.deepEqual([vehicleForward.source_node_id, vehicleForward.target_node_id], ["node:osm:1", "node:osm:2"]);
  assert.equal(way10.filter((edge) => edge.modes.includes("pedestrian")).length, 2, "generic oneway must not restrict pedestrians");
  const reverse = result.graph.edges.find((edge) => edge.id.includes("way%3A11") && edge.modes.includes("motor_vehicle"));
  assert.ok(reverse);
  assert.deepEqual([reverse.source_node_id, reverse.target_node_id], ["node:osm:3", "node:osm:2"]);
  assert.equal(result.graph.edges.filter((edge) => edge.id.includes("way%3A12")).length, 2);
});

test("OSM supported via-node restrictions compile to mode-scoped forbidden transitions", () => {
  const document: OsmOverpassDocument = {
    elements: [
      ...baseElements,
      { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary" } },
      { type: "way", id: 11, nodes: [2, 3], tags: { highway: "primary" } },
      { type: "relation", id: 20, members: [
        { type: "way", ref: 10, role: "from" },
        { type: "node", ref: 2, role: "via" },
        { type: "way", ref: 11, role: "to" },
      ], tags: { type: "restriction", restriction: "no_left_turn" } },
    ],
  };
  const result = importOsmOverpassRoadGraph(document, dataset);
  assert.equal(result.source_restriction_relation_count, 1);
  assert.equal(result.restriction_audit.imported_relation_count, 1);
  assert.equal(result.graph.turn_rules.length, 1);
  assert.deepEqual(result.graph.turn_rules[0]?.modes, ["motor_vehicle", "bicycle"]);
});

test("OSM only-turn restrictions forbid every other eligible outgoing transition", () => {
  const result = importOsmOverpassRoadGraph({ elements: [
    ...baseElements,
    { type: "node", id: 4, lon: -79.379, lat: 43.651 },
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary" } },
    { type: "way", id: 11, nodes: [2, 3], tags: { highway: "primary" } },
    { type: "way", id: 12, nodes: [2, 4], tags: { highway: "primary" } },
    { type: "relation", id: 20, members: [
      { type: "way", ref: 10, role: "from" },
      { type: "node", ref: 2, role: "via" },
      { type: "way", ref: 11, role: "to" },
    ], tags: { type: "restriction", restriction: "only_right_turn" } },
  ] }, dataset);
  const ruleToAlternative = result.graph.turn_rules.find((turn) => turn.to_edge_id.includes("way%3A12"));
  assert.ok(ruleToAlternative);
  assert.equal(ruleToAlternative.kind, "forbidden");
});

test("OSM restriction audit explicitly rejects conditional, except, mode-specific, and via-way semantics", () => {
  const unsupported = [
    { type: "relation" as const, id: 21, members: [], tags: { type: "restriction", restriction: "no_left_turn", "restriction:conditional": "no_left_turn @ (Mo-Fr 07:00-09:00)" } },
    { type: "relation" as const, id: 22, members: [], tags: { type: "restriction", restriction: "no_right_turn", except: "bus;bicycle" } },
    { type: "relation" as const, id: 23, members: [], tags: { type: "restriction", "restriction:bicycle": "two_stage_turn_box" } },
    { type: "relation" as const, id: 24, members: [
      { type: "way" as const, ref: 10, role: "from" },
      { type: "way" as const, ref: 11, role: "via" },
      { type: "way" as const, ref: 12, role: "to" },
    ], tags: { type: "restriction", restriction: "no_u_turn" } },
  ];
  const result = importOsmOverpassRoadGraph({
    elements: [
      ...baseElements,
      { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary" } },
      ...unsupported,
    ],
  }, dataset);
  assert.deepEqual(result.restriction_audit.disposition_counts, {
    imported: 0,
    partially_imported_except: 0,
    unsupported_conditional: 1,
    unsupported_mode_specific: 1,
    unsupported_except: 1,
    unsupported_via_way: 1,
    invalid_member_shape: 0,
    unsupported_restriction_value: 0,
    unresolved_way_or_direction: 0,
  });
  assert.equal(result.graph.turn_rules.length, 0);
});

test("OSM except and mode-specific restrictions compile only unambiguous supported modes", () => {
  const members = [
    { type: "way" as const, ref: 10, role: "from" },
    { type: "node" as const, ref: 2, role: "via" },
    { type: "way" as const, ref: 11, role: "to" },
  ];
  const result = importOsmOverpassRoadGraph({ elements: [
    ...baseElements,
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary" } },
    { type: "way", id: 11, nodes: [2, 3], tags: { highway: "primary" } },
    { type: "relation", id: 30, members, tags: { type: "restriction", restriction: "no_left_turn", except: "bus" } },
    { type: "relation", id: 31, members, tags: { type: "restriction", "restriction:bicycle": "no_right_turn" } },
  ] }, dataset);
  assert.equal(result.restriction_audit.disposition_counts.partially_imported_except, 1);
  assert.ok(result.graph.turn_rules.every((turn) => turn.modes.includes("bicycle") && !turn.modes.includes("motor_vehicle")));
  assert.ok(result.restriction_concerns.some((concern) => concern.relation_id === 30 && concern.affected_modes.includes("motor_vehicle")));
  assert.ok(result.restriction_audit.relations.find((item) => item.relation_id === 31)?.generated_turn_rule_ids.length === 1, "duplicate equivalent bicycle transition retains source-to-derived traceability");
});

test("OSM one-way exceptions and restricted access remain mode-specific", () => {
  const result = importOsmOverpassRoadGraph({ elements: [
    ...baseElements,
    { type: "way", id: 10, nodes: [1, 2], tags: { highway: "primary", oneway: "yes", "oneway:bicycle": "no" } },
    { type: "way", id: 11, nodes: [2, 3], tags: { highway: "service", access: "private" } },
  ] }, dataset);
  const bicycle = result.graph.edges.filter((edge) => edge.id.includes("way%3A10") && edge.modes.includes("bicycle"));
  assert.equal(bicycle.length, 2);
  assert.equal(result.graph.edges.some((edge) => edge.id.includes("way%3A11")), false);
  assert.ok(result.warnings.some((warning) => warning.code === "no_supported_modes"));
});

test("OSM missing way endpoints fail rather than silently changing topology", () => {
  const document: OsmOverpassDocument = {
    elements: [
      ...baseElements.slice(0, 1),
      { type: "way", id: 10, nodes: [1, 999], tags: { highway: "primary" } },
    ],
  };
  assert.throws(() => importOsmOverpassRoadGraph(document, dataset), GraphImportError);
});
