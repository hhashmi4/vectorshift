import {
  type CoordinateE7,
  type GraphDatasetMetadata,
  type RoadGraph,
  type RoadGraphImportInput,
  type RoadHierarchy,
  type SegmentDirection,
  type TravelMode,
} from "./types.ts";
import { GraphImportError, importRoadGraph } from "./import.ts";
import { compileOsmViaNodeRestrictions, type OsmRestrictionAudit, type OsmRestrictionConcern } from "./osm-restrictions.ts";
import { assertValidGraph } from "./validation.ts";

interface OsmNodeElement {
  readonly type: "node";
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
}

export interface OsmWayElement {
  readonly type: "way";
  readonly id: number;
  readonly nodes: readonly number[];
  readonly tags?: Readonly<Record<string, string>>;
}

export interface OsmRelationMember {
  readonly type: "node" | "way" | "relation";
  readonly ref: number;
  readonly role: string;
}

export interface OsmRelationElement {
  readonly type: "relation";
  readonly id: number;
  readonly members?: readonly OsmRelationMember[];
  readonly tags?: Readonly<Record<string, string>>;
}

type OsmElement = OsmNodeElement | OsmWayElement | OsmRelationElement;

export interface OsmOverpassDocument {
  readonly elements: readonly OsmElement[];
}

export interface OsmImportWarning {
  readonly code: string;
  readonly source_id: string;
  readonly message: string;
}

export interface OsmImportResult {
  readonly graph: RoadGraph;
  readonly warnings: readonly OsmImportWarning[];
  readonly source_highway_way_count: number;
  readonly source_restriction_relation_count: number;
  readonly restriction_audit: OsmRestrictionAudit;
  readonly restriction_concerns: readonly OsmRestrictionConcern[];
}

const defaultMotorSpeedKph: Readonly<Record<RoadHierarchy, number>> = {
  motorway: 90,
  trunk: 70,
  primary: 50,
  secondary: 40,
  tertiary: 35,
  residential: 30,
  service: 20,
  living_street: 10,
  path: 10,
  other: 25,
};

function toE7(longitude: number, latitude: number): CoordinateE7 {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new GraphImportError("OSM node coordinates must be finite numbers");
  }
  return [Math.round(longitude * 10_000_000), Math.round(latitude * 10_000_000)];
}

function hierarchyFor(highway: string): RoadHierarchy {
  const normalized = highway.replace(/_link$/, "");
  if (["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service", "living_street"].includes(normalized)) {
    return normalized as RoadHierarchy;
  }
  if (["footway", "pedestrian", "steps", "cycleway", "path", "track", "bridleway"].includes(normalized)) return "path";
  return "other";
}

const deniedAccessValues = new Set(["no", "private", "customers", "delivery", "destination", "permit"]);
const allowedAccessValues = new Set(["yes", "designated", "permissive", "official"]);

function applyAccessValue(current: boolean, value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined) return current;
  if (deniedAccessValues.has(normalized)) return false;
  if (allowedAccessValues.has(normalized)) return true;
  return current;
}

function modesFor(highway: string, tags: Readonly<Record<string, string>>, warnings: OsmImportWarning[], wayId: number): TravelMode[] {
  const normalized = highway.replace(/_link$/, "");
  let modes: TravelMode[];
  if (["motorway", "motorway_link"].includes(highway)) modes = ["motor_vehicle"];
  else if (normalized === "trunk") modes = ["motor_vehicle"];
  else if (["footway", "pedestrian", "steps"].includes(normalized)) modes = ["pedestrian"];
  else if (normalized === "cycleway") modes = ["bicycle", "pedestrian"];
  else if (["path", "track", "bridleway"].includes(normalized)) modes = ["bicycle", "pedestrian"];
  else modes = ["motor_vehicle", "bicycle", "pedestrian"];

  if (Object.keys(tags).some((key) => key.startsWith("access:") && key.endsWith(":conditional")) || tags.access_conditional !== undefined) {
    warnings.push({ code: "unsupported_conditional_access", source_id: `way/${wayId}`, message: "conditional access was not evaluated; unconditional tags remain authoritative" });
  }
  const defaults = new Set(modes);
  let motor = defaults.has("motor_vehicle");
  if (motor) motor = applyAccessValue(applyAccessValue(motor, tags.access), tags.vehicle);
  motor = applyAccessValue(motor, tags.motor_vehicle);
  motor = applyAccessValue(motor, tags.motorcar);
  let bicycle = defaults.has("bicycle");
  if (bicycle) bicycle = applyAccessValue(applyAccessValue(bicycle, tags.access), tags.vehicle);
  bicycle = applyAccessValue(bicycle, tags.bicycle);
  let pedestrian = defaults.has("pedestrian");
  if (pedestrian) pedestrian = applyAccessValue(pedestrian, tags.access);
  pedestrian = applyAccessValue(pedestrian, tags.foot);
  return ([
    ...(motor ? ["motor_vehicle" as const] : []),
    ...(bicycle ? ["bicycle" as const] : []),
    ...(pedestrian ? ["pedestrian" as const] : []),
  ] satisfies TravelMode[]).sort();
}

function parseDirection(value: string | undefined, warnings: OsmImportWarning[], wayId: number, tagName: string): SegmentDirection | undefined {
  value = value?.trim().toLowerCase();
  if (["yes", "true", "1"].includes(value ?? "")) return "forward";
  if (["-1", "reverse"].includes(value ?? "")) return "backward";
  if (["no", "false", "0"].includes(value ?? "")) return "both";
  if (value !== undefined) {
    warnings.push({
      code: "unsupported_oneway_value",
      source_id: `way/${wayId}`,
      message: `unsupported ${tagName}=${value}; imported conservatively using the next applicable direction rule`,
    });
  }
  return undefined;
}

function directionsForModes(
  tags: Readonly<Record<string, string>>,
  modes: readonly TravelMode[],
  warnings: OsmImportWarning[],
  wayId: number,
): ReadonlyMap<TravelMode, SegmentDirection> {
  const implicitVehicleDirection: SegmentDirection = tags.junction === "roundabout" || tags.highway === "motorway" || tags.highway === "motorway_link"
    ? "forward"
    : "both";
  const generic = parseDirection(tags.oneway, warnings, wayId, "oneway") ?? implicitVehicleDirection;
  const result = new Map<TravelMode, SegmentDirection>();
  for (const mode of modes) {
    if (mode === "pedestrian") {
      result.set(mode, parseDirection(tags["oneway:foot"], warnings, wayId, "oneway:foot") ?? "both");
    } else if (mode === "bicycle") {
      result.set(mode, parseDirection(tags["oneway:bicycle"], warnings, wayId, "oneway:bicycle") ?? generic);
    } else {
      result.set(mode, parseDirection(tags["oneway:motor_vehicle"] ?? tags["oneway:motorcar"], warnings, wayId, "oneway:motor_vehicle") ?? generic);
    }
  }
  return result;
}

function haversineLengthMm(left: CoordinateE7, right: CoordinateE7): number {
  const radians = Math.PI / 180;
  const latitude1 = left[1] / 10_000_000 * radians;
  const latitude2 = right[1] / 10_000_000 * radians;
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = (right[0] - left[0]) / 10_000_000 * radians;
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const a = Math.min(1, Math.max(0, sinLatitude ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * sinLongitude ** 2));
  const distanceMetres = 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(distanceMetres * 1_000);
}

function parsedMotorSpeedKph(tags: Readonly<Record<string, string>>, hierarchy: RoadHierarchy, warnings: OsmImportWarning[], wayId: number): number {
  const raw = tags.maxspeed?.trim();
  if (raw === undefined) return defaultMotorSpeedKph[hierarchy];
  const match = /^(\d+(?:\.\d+)?)\s*(?:km\/h)?$/i.exec(raw);
  if (match) {
    const speed = Number(match[1]);
    if (speed > 0 && Number.isFinite(speed)) return speed;
  }
  warnings.push({
    code: "unsupported_maxspeed",
    source_id: `way/${wayId}`,
    message: `unsupported maxspeed=${raw}; used hierarchy default`,
  });
  return defaultMotorSpeedKph[hierarchy];
}

function traversalTimes(lengthMm: number, modes: readonly TravelMode[], motorSpeedKph: number): Partial<Record<TravelMode, number>> {
  const speeds: Readonly<Record<TravelMode, number>> = {
    motor_vehicle: motorSpeedKph,
    bicycle: 15,
    pedestrian: 5,
  };
  return Object.fromEntries(modes.map((mode) => [mode, Math.max(1, Math.ceil(lengthMm * 3.6 / speeds[mode]))]));
}

export function importOsmOverpassRoadGraph(
  document: OsmOverpassDocument,
  dataset: GraphDatasetMetadata,
): OsmImportResult {
  if (!document || !Array.isArray(document.elements)) throw new GraphImportError("OSM document must contain an elements array");
  const warnings: OsmImportWarning[] = [];
  const coordinates = new Map<number, CoordinateE7>();
  const ways: OsmWayElement[] = [];
  const restrictionRelations: OsmRelationElement[] = [];

  for (const element of document.elements) {
    if (element.type === "node") {
      if (coordinates.has(element.id)) throw new GraphImportError(`duplicate OSM node ${element.id}`);
      coordinates.set(element.id, toE7(element.lon, element.lat));
    } else if (element.type === "way" && typeof element.tags?.highway === "string") {
      ways.push(element);
    } else if (element.type === "relation" && element.tags?.type === "restriction") {
      restrictionRelations.push(element);
    }
  }

  const usedNodeIds = new Set<number>();
  const segments: RoadGraphImportInput["segments"][number][] = [];
  for (const way of ways.sort((left, right) => left.id - right.id)) {
    const tags = way.tags ?? {};
    if (!Array.isArray(way.nodes) || way.nodes.length < 2) {
      warnings.push({ code: "short_highway_way", source_id: `way/${way.id}`, message: "highway way has fewer than two nodes and was skipped" });
      continue;
    }
    const highway = tags.highway;
    if (highway === undefined) continue;
    const hierarchy = hierarchyFor(highway);
    const modes = modesFor(highway, tags, warnings, way.id);
    if (modes.length === 0) {
      warnings.push({ code: "no_supported_modes", source_id: `way/${way.id}`, message: "way permits no supported travel mode and was skipped" });
      continue;
    }
    const directions = directionsForModes(tags, modes, warnings, way.id);
    const motorSpeed = parsedMotorSpeedKph(tags, hierarchy, warnings, way.id);
    for (let index = 0; index < way.nodes.length - 1; index += 1) {
      const from = way.nodes[index];
      const to = way.nodes[index + 1];
      const fromCoordinate = coordinates.get(from);
      const toCoordinate = coordinates.get(to);
      if (!fromCoordinate || !toCoordinate) {
        throw new GraphImportError(`OSM way ${way.id} segment ${index} references missing endpoint node`);
      }
      usedNodeIds.add(from);
      usedNodeIds.add(to);
      const lengthMm = haversineLengthMm(fromCoordinate, toCoordinate);
      const grouped = new Map<SegmentDirection, TravelMode[]>();
      for (const mode of modes) {
        const direction = directions.get(mode);
        if (direction !== undefined) grouped.set(direction, [...(grouped.get(direction) ?? []), mode]);
      }
      for (const [direction, directionModes] of [...grouped.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
        directionModes.sort();
        segments.push({
          source_segment_id: `way:${way.id}:segment:${index}:modes:${directionModes.join("+")}`,
          from_source_node_id: String(from),
          to_source_node_id: String(to),
          direction,
          hierarchy,
          modes: directionModes,
          length_mm: lengthMm,
          traversal_time_ms_by_mode: traversalTimes(lengthMm, directionModes, motorSpeed),
          geometry_e7: [fromCoordinate, toCoordinate],
        });
      }
    }
  }

  const input: RoadGraphImportInput = {
    namespace: "osm",
    dataset,
    nodes: [...usedNodeIds].sort((left, right) => left - right).map((id) => ({
      source_node_id: String(id),
      coordinate_e7: coordinates.get(id)!,
    })),
    segments,
    turn_rules: [],
  };
  const baseGraph = importRoadGraph(input);
  const compiled = compileOsmViaNodeRestrictions(baseGraph, restrictionRelations);
  const graph: RoadGraph = { ...baseGraph, turn_rules: compiled.turn_rules };
  assertValidGraph(graph);
  for (const [disposition, count] of Object.entries(compiled.audit.disposition_counts)) {
    if (disposition !== "imported" && count > 0) warnings.push({
      code: `restriction_${disposition}`,
      source_id: "relations/type=restriction",
      message: `${count} restriction relation(s) classified as ${disposition}`,
    });
  }
  warnings.sort((left, right) => {
    const sourceOrder = left.source_id < right.source_id ? -1 : left.source_id > right.source_id ? 1 : 0;
    if (sourceOrder !== 0) return sourceOrder;
    return left.code < right.code ? -1 : left.code > right.code ? 1 : 0;
  });
  return {
    graph,
    warnings,
    source_highway_way_count: ways.length,
    source_restriction_relation_count: restrictionRelations.length,
    restriction_audit: compiled.audit,
    restriction_concerns: compiled.concerns,
  };
}
