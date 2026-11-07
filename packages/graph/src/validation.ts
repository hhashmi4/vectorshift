import {
  COORDINATE_SCALE,
  GRAPH_FORMAT,
  GRAPH_SCHEMA_VERSION,
  ROAD_HIERARCHIES,
  TRAVEL_MODES,
  type CoordinateE7,
  type GraphValidationIssue,
  type RoadGraph,
} from "./types.ts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/%+-]{0,255}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const hierarchySet = new Set<string>(ROAD_HIERARCHIES);
const modeSet = new Set<string>(TRAVEL_MODES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameCoordinate(left: CoordinateE7, right: CoordinateE7): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export function validateRoadGraph(value: unknown): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const issue = (code: string, path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  const object = (
    candidate: unknown,
    path: string,
    required: readonly string[],
    optional: readonly string[] = [],
  ): Record<string, unknown> | undefined => {
    if (!isRecord(candidate)) {
      issue("invalid_type", path, "expected an object");
      return undefined;
    }
    const allowed = new Set([...required, ...optional]);
    for (const key of required) {
      if (!Object.hasOwn(candidate, key)) issue("missing_property", `${path}/${key}`, "required property is missing");
    }
    for (const key of Object.keys(candidate)) {
      if (!allowed.has(key)) issue("unknown_property", `${path}/${key}`, "unknown property is not allowed");
    }
    return candidate;
  };

  const text = (candidate: unknown, path: string, kind = "text"): string | undefined => {
    if (typeof candidate !== "string" || candidate.length === 0) {
      issue("invalid_string", path, `expected non-empty ${kind}`);
      return undefined;
    }
    return candidate;
  };

  const identifier = (candidate: unknown, path: string): string | undefined => {
    const result = text(candidate, path, "identifier");
    if (result !== undefined && !IDENTIFIER.test(result)) {
      issue("invalid_identifier", path, "identifier contains unsupported characters or exceeds 256 characters");
      return undefined;
    }
    return result;
  };

  const positiveInteger = (candidate: unknown, path: string): number | undefined => {
    if (!Number.isSafeInteger(candidate) || Number(candidate) <= 0) {
      issue("invalid_positive_integer", path, "expected a positive safe integer");
      return undefined;
    }
    return Number(candidate);
  };

  const nonNegativeInteger = (candidate: unknown, path: string): number | undefined => {
    if (!Number.isSafeInteger(candidate) || Number(candidate) < 0) {
      issue("invalid_non_negative_integer", path, "expected a non-negative safe integer");
      return undefined;
    }
    return Number(candidate);
  };

  const coordinate = (candidate: unknown, path: string): CoordinateE7 | undefined => {
    if (!Array.isArray(candidate) || candidate.length !== 2) {
      issue("invalid_coordinate", path, "expected [longitude_e7, latitude_e7]");
      return undefined;
    }
    const [longitude, latitude] = candidate;
    if (!Number.isSafeInteger(longitude) || longitude < -1_800_000_000 || longitude > 1_800_000_000) {
      issue("invalid_longitude", `${path}/0`, "longitude E7 is outside [-180, 180] degrees");
      return undefined;
    }
    if (!Number.isSafeInteger(latitude) || latitude < -900_000_000 || latitude > 900_000_000) {
      issue("invalid_latitude", `${path}/1`, "latitude E7 is outside [-90, 90] degrees");
      return undefined;
    }
    return [longitude, latitude];
  };

  const root = object(value, "", ["format", "schema_version", "dataset", "crs", "nodes", "edges", "turn_rules"]);
  if (!root) return issues;
  if (root.format !== GRAPH_FORMAT) issue("unsupported_format", "/format", `expected ${GRAPH_FORMAT}`);
  if (root.schema_version !== GRAPH_SCHEMA_VERSION) issue("unsupported_schema_version", "/schema_version", "expected schema version 2");

  const dataset = object(root.dataset, "/dataset", ["dataset_id", "dataset_version", "source"]);
  if (dataset) {
    identifier(dataset.dataset_id, "/dataset/dataset_id");
    identifier(dataset.dataset_version, "/dataset/dataset_version");
    const source = object(dataset.source, "/dataset/source", [
      "provider", "source_uri", "license", "attribution", "acquired_at", "snapshot_at",
      "bounds", "source_sha256", "pipeline_version",
    ]);
    if (source) {
      text(source.provider, "/dataset/source/provider");
      text(source.source_uri, "/dataset/source/source_uri");
      text(source.license, "/dataset/source/license");
      text(source.attribution, "/dataset/source/attribution");
      for (const field of ["acquired_at", "snapshot_at"] as const) {
        const timestamp = text(source[field], `/dataset/source/${field}`, "RFC 3339 timestamp");
        if (timestamp !== undefined && (!timestamp.endsWith("Z") || !Number.isFinite(Date.parse(timestamp)))) {
          issue("invalid_timestamp", `/dataset/source/${field}`, "expected a valid UTC RFC 3339 timestamp");
        }
      }
      if (typeof source.source_sha256 !== "string" || !SHA256.test(source.source_sha256)) {
        issue("invalid_sha256", "/dataset/source/source_sha256", "expected a lowercase SHA-256 hex digest");
      }
      identifier(source.pipeline_version, "/dataset/source/pipeline_version");
      const bounds = object(source.bounds, "/dataset/source/bounds", ["south_e7", "west_e7", "north_e7", "east_e7"]);
      if (bounds) {
        const south = coordinate([bounds.west_e7, bounds.south_e7], "/dataset/source/bounds/south_west");
        const north = coordinate([bounds.east_e7, bounds.north_e7], "/dataset/source/bounds/north_east");
        if (south && north && (south[1] >= north[1] || south[0] >= north[0])) {
          issue("invalid_bounds", "/dataset/source/bounds", "expected south < north and west < east");
        }
      }
    }
  }

  const crs = object(root.crs, "/crs", ["identifier", "axis_order", "coordinate_scale"]);
  if (crs) {
    if (crs.identifier !== "EPSG:4326") issue("unsupported_crs", "/crs/identifier", "schema v2 requires EPSG:4326");
    if (crs.axis_order !== "longitude-latitude") issue("unsupported_axis_order", "/crs/axis_order", "expected longitude-latitude");
    if (crs.coordinate_scale !== COORDINATE_SCALE) issue("unsupported_coordinate_scale", "/crs/coordinate_scale", "expected E7 scale");
  }

  const nodeById = new Map<string, CoordinateE7>();
  if (!Array.isArray(root.nodes)) {
    issue("invalid_type", "/nodes", "expected an array");
  } else {
    root.nodes.forEach((candidate, index) => {
      const path = `/nodes/${index}`;
      const node = object(candidate, path, ["id", "coordinate_e7", "source"]);
      if (!node) return;
      const id = identifier(node.id, `${path}/id`);
      const point = coordinate(node.coordinate_e7, `${path}/coordinate_e7`);
      if (id && nodeById.has(id)) issue("duplicate_node_id", `${path}/id`, `duplicate node ID ${id}`);
      else if (id && point) nodeById.set(id, point);
      const source = object(node.source, `${path}/source`, ["namespace", "source_id"]);
      if (source) {
        identifier(source.namespace, `${path}/source/namespace`);
        text(source.source_id, `${path}/source/source_id`, "source ID");
      }
    });
  }

  const edgeById = new Map<string, { source: string; target: string; modes: ReadonlySet<string> }>();
  if (!Array.isArray(root.edges)) {
    issue("invalid_type", "/edges", "expected an array");
  } else {
    root.edges.forEach((candidate, index) => {
      const path = `/edges/${index}`;
      const edge = object(candidate, path, [
        "id", "source_node_id", "target_node_id", "source_segment_id", "hierarchy", "modes",
        "length_mm", "traversal_time_ms_by_mode", "geometry_e7",
      ]);
      if (!edge) return;
      const id = identifier(edge.id, `${path}/id`);
      const sourceId = identifier(edge.source_node_id, `${path}/source_node_id`);
      const targetId = identifier(edge.target_node_id, `${path}/target_node_id`);
      text(edge.source_segment_id, `${path}/source_segment_id`, "source segment ID");
      const duplicateEdgeId = id !== undefined && edgeById.has(id);
      if (duplicateEdgeId) issue("duplicate_edge_id", `${path}/id`, `duplicate edge ID ${id}`);
      if (sourceId && !nodeById.has(sourceId)) issue("missing_edge_source", `${path}/source_node_id`, `node ${sourceId} does not exist`);
      if (targetId && !nodeById.has(targetId)) issue("missing_edge_target", `${path}/target_node_id`, `node ${targetId} does not exist`);
      if (sourceId && targetId && sourceId === targetId) issue("self_loop_unsupported", path, "schema v2 does not support self-loop road edges");
      if (typeof edge.hierarchy !== "string" || !hierarchySet.has(edge.hierarchy)) {
        issue("invalid_hierarchy", `${path}/hierarchy`, "unknown road hierarchy");
      }
      const validModes = new Set<string>();
      if (!Array.isArray(edge.modes) || edge.modes.length === 0) {
        issue("invalid_modes", `${path}/modes`, "expected at least one permitted mode");
      } else {
        const seen = new Set<string>();
        edge.modes.forEach((mode, modeIndex) => {
          if (typeof mode !== "string" || !modeSet.has(mode)) issue("invalid_mode", `${path}/modes/${modeIndex}`, "unknown travel mode");
          else if (seen.has(mode)) issue("duplicate_mode", `${path}/modes/${modeIndex}`, `duplicate mode ${mode}`);
          else {
            seen.add(mode);
            validModes.add(mode);
          }
        });
      }
      if (id && sourceId && targetId && !duplicateEdgeId) edgeById.set(id, { source: sourceId, target: targetId, modes: validModes });
      positiveInteger(edge.length_mm, `${path}/length_mm`);
      const costs = object(edge.traversal_time_ms_by_mode, `${path}/traversal_time_ms_by_mode`, [], [...TRAVEL_MODES]);
      if (costs) {
        for (const mode of validModes) {
          if (!Object.hasOwn(costs, mode)) issue("missing_mode_cost", `${path}/traversal_time_ms_by_mode/${mode}`, `missing traversal time for ${mode}`);
        }
        for (const [mode, cost] of Object.entries(costs)) {
          if (!validModes.has(mode)) issue("cost_for_unpermitted_mode", `${path}/traversal_time_ms_by_mode/${mode}`, `cost provided for unpermitted mode ${mode}`);
          nonNegativeInteger(cost, `${path}/traversal_time_ms_by_mode/${mode}`);
        }
      }
      if (!Array.isArray(edge.geometry_e7) || edge.geometry_e7.length < 2) {
        issue("invalid_geometry", `${path}/geometry_e7`, "expected at least two coordinates");
      } else {
        const points = edge.geometry_e7.map((point, pointIndex) => coordinate(point, `${path}/geometry_e7/${pointIndex}`));
        const validPoints = points.filter((point): point is CoordinateE7 => point !== undefined);
        if (validPoints.length === points.length && validPoints.length >= 2) {
          const firstPoint = validPoints[0];
          const lastPoint = validPoints.at(-1);
          if (firstPoint !== undefined && validPoints.every((point) => sameCoordinate(point, firstPoint))) {
            issue("zero_length_geometry", `${path}/geometry_e7`, "geometry must contain at least two distinct coordinates");
          }
          const sourcePoint = sourceId ? nodeById.get(sourceId) : undefined;
          const targetPoint = targetId ? nodeById.get(targetId) : undefined;
          if (sourcePoint && firstPoint !== undefined && !sameCoordinate(firstPoint, sourcePoint)) {
            issue("geometry_source_mismatch", `${path}/geometry_e7/0`, "first coordinate does not match source node");
          }
          if (targetPoint && lastPoint !== undefined && !sameCoordinate(lastPoint, targetPoint)) {
            issue("geometry_target_mismatch", `${path}/geometry_e7/${validPoints.length - 1}`, "last coordinate does not match target node");
          }
        }
      }
    });
  }

  const turnIds = new Set<string>();
  const turnTransitions = new Set<string>();
  if (!Array.isArray(root.turn_rules)) {
    issue("invalid_type", "/turn_rules", "expected an array");
  } else {
    root.turn_rules.forEach((candidate, index) => {
      const path = `/turn_rules/${index}`;
      const turn = object(candidate, path, ["id", "via_node_id", "from_edge_id", "to_edge_id", "modes", "kind"], ["penalty_ms"]);
      if (!turn) return;
      const id = identifier(turn.id, `${path}/id`);
      const via = identifier(turn.via_node_id, `${path}/via_node_id`);
      const fromId = identifier(turn.from_edge_id, `${path}/from_edge_id`);
      const toId = identifier(turn.to_edge_id, `${path}/to_edge_id`);
      if (id && turnIds.has(id)) issue("duplicate_turn_id", `${path}/id`, `duplicate turn rule ID ${id}`);
      else if (id) turnIds.add(id);
      const from = fromId ? edgeById.get(fromId) : undefined;
      const to = toId ? edgeById.get(toId) : undefined;
      if (fromId && !from) issue("missing_turn_from_edge", `${path}/from_edge_id`, `edge ${fromId} does not exist`);
      if (toId && !to) issue("missing_turn_to_edge", `${path}/to_edge_id`, `edge ${toId} does not exist`);
      if (via && !nodeById.has(via)) issue("missing_turn_via_node", `${path}/via_node_id`, `node ${via} does not exist`);
      if (from && via && from.target !== via) issue("invalid_turn_incoming", path, "incoming edge does not end at via node");
      if (to && via && to.source !== via) issue("invalid_turn_outgoing", path, "outgoing edge does not start at via node");
      const turnModes = new Set<string>();
      if (!Array.isArray(turn.modes) || turn.modes.length === 0) {
        issue("invalid_turn_modes", `${path}/modes`, "expected at least one restricted mode");
      } else {
        turn.modes.forEach((mode, modeIndex) => {
          if (typeof mode !== "string" || !modeSet.has(mode)) issue("invalid_turn_mode", `${path}/modes/${modeIndex}`, "unknown travel mode");
          else if (turnModes.has(mode)) issue("duplicate_turn_mode", `${path}/modes/${modeIndex}`, `duplicate turn mode ${mode}`);
          else {
            turnModes.add(mode);
            if (from && !from.modes.has(mode)) issue("turn_mode_not_on_from_edge", `${path}/modes/${modeIndex}`, `${mode} is not permitted on the incoming edge`);
            if (to && !to.modes.has(mode)) issue("turn_mode_not_on_to_edge", `${path}/modes/${modeIndex}`, `${mode} is not permitted on the outgoing edge`);
            if (fromId && toId) {
              const transition = `${fromId}\u0000${toId}\u0000${mode}`;
              if (turnTransitions.has(transition)) issue("duplicate_turn_transition", path, `duplicate ${mode} rule for the same edge transition`);
              else turnTransitions.add(transition);
            }
          }
        });
      }
      if (turn.kind === "forbidden") {
        if (Object.hasOwn(turn, "penalty_ms")) issue("forbidden_turn_penalty", `${path}/penalty_ms`, "forbidden turn must not include a penalty");
      } else if (turn.kind === "penalty") {
        positiveInteger(turn.penalty_ms, `${path}/penalty_ms`);
      } else {
        issue("invalid_turn_kind", `${path}/kind`, "expected forbidden or penalty");
      }
    });
  }

  const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
  return issues.sort((left, right) =>
    compare(left.path, right.path) || compare(left.code, right.code) || compare(left.message, right.message),
  );
}

export class GraphValidationError extends Error {
  readonly issues: readonly GraphValidationIssue[];

  constructor(issues: readonly GraphValidationIssue[]) {
    super(`road graph validation failed with ${issues.length} issue(s): ${issues.map((item) => `${item.path} ${item.code}`).join(", ")}`);
    this.name = "GraphValidationError";
    this.issues = issues;
  }
}

export function assertValidGraph(value: unknown): asserts value is RoadGraph {
  const issues = validateRoadGraph(value);
  if (issues.length > 0) throw new GraphValidationError(issues);
}
