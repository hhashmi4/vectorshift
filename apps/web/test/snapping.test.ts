import assert from "node:assert/strict";
import test from "node:test";
import { snapToEligibleEndpoint } from "../lib/snapping.ts";

test("snapping selects the nearest eligible node with deterministic ID tie-breaking", () => {
  const endpoints = [
    { id: "node:b", longitude: -79.38, latitude: 43.65, boundary_distance_m: 500 },
    { id: "node:a", longitude: -79.38, latitude: 43.65, boundary_distance_m: 500 },
    { id: "node:far", longitude: -79.4, latitude: 43.67, boundary_distance_m: 500 },
  ];
  const result = snapToEligibleEndpoint(endpoints, -79.38, 43.65, 100);
  assert.equal(result?.endpoint.id, "node:a");
  assert.equal(result?.distance_m, 0);
});

test("snapping rejects distant and invalid selections", () => {
  const endpoints = [{ id: "node:a", longitude: -79.38, latitude: 43.65, boundary_distance_m: 500 }];
  assert.equal(snapToEligibleEndpoint(endpoints, -79.5, 43.8, 20), null);
  assert.throws(() => snapToEligibleEndpoint(endpoints, Number.NaN, 43.8), TypeError);
});
