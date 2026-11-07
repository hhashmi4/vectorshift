import assert from "node:assert/strict";
import test from "node:test";
import { CITY_PRESETS, cityPreset, cityPresetAt, graphCoverageAt, graphCoverageForPreset, isAtCityPreset } from "../lib/map-foundation.ts";

test("worldwide city presets are deterministic and include the required Ontario destinations", () => {
  assert.deepEqual(CITY_PRESETS.map((preset) => preset.id), ["world", "toronto", "welland", "niagara-falls"]);
  assert.deepEqual(cityPreset("welland").center, [-79.2483, 42.9922]);
  assert.deepEqual(cityPreset("niagara-falls").center, [-79.0849, 43.0896]);
});

test("coverage distinguishes the bounded experimental Toronto graph from worldwide exploration", () => {
  assert.equal(graphCoverageAt(-79.3805, 43.6482).status, "experimental");
  assert.equal(graphCoverageAt(-79.2483, 42.9922).status, "none");
  assert.equal(graphCoverageAt(-79.0849, 43.0896).status, "none");
  assert.equal(graphCoverageAt(2.3522, 48.8566).status, "none");
});

test("selected preset coverage resolves directly without waiting for camera state", () => {
  assert.equal(graphCoverageForPreset("toronto").status, "experimental");
  assert.equal(graphCoverageForPreset("welland").status, "none");
  assert.equal(graphCoverageForPreset("niagara-falls").status, "none");
  assert.equal(graphCoverageForPreset("world").status, "none");
});

test("viewport preset matching is deterministic and distinct from target arrival", () => {
  assert.equal(cityPresetAt(-79.3805, 43.6482)?.id, "toronto");
  assert.equal(cityPresetAt(-79.2483, 42.9922)?.id, "welland");
  assert.equal(cityPresetAt(-79.1, 43.1), null);
  assert.equal(isAtCityPreset(-79.2483, 42.9922, "welland"), true);
  assert.equal(isAtCityPreset(-79.247, 42.9922, "welland"), false);
});

test("coverage rejects invalid WGS84 coordinates instead of inventing a region", () => {
  assert.throws(() => graphCoverageAt(Number.NaN, 43), TypeError);
  assert.throws(() => graphCoverageAt(181, 43), TypeError);
  assert.throws(() => graphCoverageAt(-79, 91), TypeError);
  assert.throws(() => cityPresetAt(Number.POSITIVE_INFINITY, 43), TypeError);
});
