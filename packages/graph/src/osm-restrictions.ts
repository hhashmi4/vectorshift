import { type DirectedRoadEdge, type RoadGraph, type TravelMode, type TurnRule } from "./types.ts";
import type { OsmRelationElement } from "./osm.ts";

export type OsmRestrictionDisposition =
  | "imported"
  | "partially_imported_except"
  | "unsupported_conditional"
  | "unsupported_mode_specific"
  | "unsupported_except"
  | "unsupported_via_way"
  | "invalid_member_shape"
  | "unsupported_restriction_value"
  | "unresolved_way_or_direction";

export type OsmRestrictionConcernCategory =
  | "conditional_without_context"
  | "mode_specific_unsupported"
  | "except_mode_ambiguity"
  | "via_way_sequence_unsupported"
  | "unresolved_source_transition";

export interface OsmRestrictionConcern {
  readonly relation_id: number;
  readonly category: OsmRestrictionConcernCategory;
  readonly restriction: string;
  readonly affected_modes: readonly TravelMode[];
  readonly from_way_ids: readonly number[];
  readonly to_way_ids: readonly number[];
  readonly via_node_ids: readonly number[];
  readonly via_way_ids: readonly number[];
  readonly except_values: readonly string[];
  readonly message: string;
}

export interface OsmRestrictionRelationResult {
  readonly relation_id: number;
  readonly restriction: string;
  readonly disposition: OsmRestrictionDisposition;
  readonly affected_modes: readonly TravelMode[];
  readonly generated_turn_rule_ids: readonly string[];
  readonly generated_turn_rule_count: number;
}

export interface OsmRestrictionAudit {
  readonly relation_count: number;
  readonly imported_relation_count: number;
  readonly partially_imported_relation_count: number;
  readonly generated_turn_rule_count: number;
  readonly concern_count: number;
  readonly disposition_counts: Readonly<Record<OsmRestrictionDisposition, number>>;
  readonly restriction_value_counts: Readonly<Record<string, number>>;
  readonly relations: readonly OsmRestrictionRelationResult[];
}

export interface CompiledOsmRestrictions {
  readonly turn_rules: readonly TurnRule[];
  readonly concerns: readonly OsmRestrictionConcern[];
  readonly audit: OsmRestrictionAudit;
}

const supportedValues = new Set([
  "no_left_turn", "no_right_turn", "no_straight_on", "no_u_turn",
  "only_left_turn", "only_right_turn", "only_straight_on", "only_u_turn",
]);
const vehicleModes: readonly TravelMode[] = ["motor_vehicle", "bicycle"];
const explicitMotorModeValues = new Set(["motor_vehicle", "motorcar"]);
const ambiguousMotorSubmodes = new Set(["bus", "psv", "taxi", "tram", "hgv", "goods", "emergency"]);

function wayIdFromSourceSegment(sourceSegmentId: string): number | undefined {
  const match = /^way:(\d+):segment:/.exec(sourceSegmentId);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function intersectionModes(desiredModes: readonly TravelMode[], ...modeLists: readonly (readonly TravelMode[])[]): TravelMode[] {
  return desiredModes.filter((mode) => modeLists.every((modes) => modes.includes(mode)));
}

function sortedUniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function uniqueNumbersInOrder(values: readonly number[]): number[] {
  const seen = new Set<number>();
  return values.filter((value) => seen.has(value) ? false : (seen.add(value), true));
}

function parseExceptValues(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(/[;,]/).map((item) => item.trim().toLowerCase()).filter(Boolean))].sort();
}

function modeFromRestrictionKey(key: string): TravelMode | undefined {
  const suffix = key.slice("restriction:".length);
  if (suffix === "bicycle") return "bicycle";
  if (suffix === "motor_vehicle" || suffix === "motorcar") return "motor_vehicle";
  if (suffix === "foot" || suffix === "pedestrian") return "pedestrian";
  return undefined;
}

export function compileOsmViaNodeRestrictions(
  graph: RoadGraph,
  relations: readonly OsmRelationElement[],
): CompiledOsmRestrictions {
  const sortedRelations = [...relations].sort((left, right) => left.id - right.id);
  const incomingByWayAndNode = new Map<string, readonly DirectedRoadEdge[]>();
  const outgoingByWayAndNode = new Map<string, readonly DirectedRoadEdge[]>();
  const outgoingByNode = new Map<string, readonly DirectedRoadEdge[]>();

  for (const edge of graph.edges) {
    const wayId = wayIdFromSourceSegment(edge.source_segment_id);
    if (wayId === undefined) continue;
    const incomingKey = `${wayId}\u0000${edge.target_node_id}`;
    const outgoingKey = `${wayId}\u0000${edge.source_node_id}`;
    incomingByWayAndNode.set(incomingKey, [...(incomingByWayAndNode.get(incomingKey) ?? []), edge]);
    outgoingByWayAndNode.set(outgoingKey, [...(outgoingByWayAndNode.get(outgoingKey) ?? []), edge]);
    outgoingByNode.set(edge.source_node_id, [...(outgoingByNode.get(edge.source_node_id) ?? []), edge]);
  }
  for (const map of [incomingByWayAndNode, outgoingByWayAndNode, outgoingByNode]) {
    for (const [key, edges] of map) map.set(key, [...edges].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  }

  const rules: TurnRule[] = [];
  const concerns: OsmRestrictionConcern[] = [];
  const ruleIdByTransition = new Map<string, string>();
  const results: OsmRestrictionRelationResult[] = [];
  const restrictionCounts = new Map<string, number>();

  const relationMembers = (relation: OsmRelationElement) => {
    const members = relation.members ?? [];
    return {
      from: members.filter((member) => member.role === "from"),
      to: members.filter((member) => member.role === "to"),
      via: members.filter((member) => member.role === "via"),
    };
  };
  const addConcern = (
    relation: OsmRelationElement,
    restriction: string,
    category: OsmRestrictionConcernCategory,
    affectedModes: readonly TravelMode[],
    message: string,
  ): void => {
    const { from, to, via } = relationMembers(relation);
    concerns.push({
      relation_id: relation.id,
      category,
      restriction,
      affected_modes: [...affectedModes].sort(),
      from_way_ids: sortedUniqueNumbers(from.filter((member) => member.type === "way").map((member) => member.ref)),
      to_way_ids: sortedUniqueNumbers(to.filter((member) => member.type === "way").map((member) => member.ref)),
      via_node_ids: sortedUniqueNumbers(via.filter((member) => member.type === "node").map((member) => member.ref)),
      via_way_ids: uniqueNumbersInOrder(via.filter((member) => member.type === "way").map((member) => member.ref)),
      except_values: parseExceptValues(relation.tags?.except),
      message,
    });
  };
  const record = (
    relation: OsmRelationElement,
    restriction: string,
    disposition: OsmRestrictionDisposition,
    affectedModes: readonly TravelMode[],
    generatedRuleIds: readonly string[] = [],
  ): void => {
    results.push({
      relation_id: relation.id,
      restriction,
      disposition,
      affected_modes: [...affectedModes].sort(),
      generated_turn_rule_ids: [...generatedRuleIds],
      generated_turn_rule_count: generatedRuleIds.length,
    });
    restrictionCounts.set(restriction, (restrictionCounts.get(restriction) ?? 0) + 1);
  };

  const compileViaNode = (
    relation: OsmRelationElement,
    restriction: string,
    desiredModes: readonly TravelMode[],
  ): { readonly status: "compiled" | "invalid" | "via_way" | "unresolved"; readonly ruleIds: readonly string[] } => {
    const { from, to, via } = relationMembers(relation);
    if (via.some((member) => member.type === "way")) return { status: "via_way", ruleIds: [] };
    if (from.length !== 1 || to.length !== 1 || via.length !== 1
      || from[0]?.type !== "way" || to[0]?.type !== "way" || via[0]?.type !== "node") {
      return { status: "invalid", ruleIds: [] };
    }
    const viaNodeId = `node:osm:${via[0].ref}`;
    const incoming = incomingByWayAndNode.get(`${from[0].ref}\u0000${viaNodeId}`) ?? [];
    const allowedOrForbidden = outgoingByWayAndNode.get(`${to[0].ref}\u0000${viaNodeId}`) ?? [];
    if (incoming.length === 0 || allowedOrForbidden.length === 0) return { status: "unresolved", ruleIds: [] };

    const pairs: Array<{ from: DirectedRoadEdge; to: DirectedRoadEdge; modes: TravelMode[] }> = [];
    if (restriction.startsWith("no_")) {
      for (const fromEdge of incoming) {
        for (const toEdge of allowedOrForbidden) {
          const modes = intersectionModes(desiredModes, fromEdge.modes, toEdge.modes);
          if (modes.length > 0) pairs.push({ from: fromEdge, to: toEdge, modes });
        }
      }
    } else {
      const allowedIds = new Set(allowedOrForbidden.map((edge) => edge.id));
      const allOutgoing = outgoingByNode.get(viaNodeId) ?? [];
      for (const fromEdge of incoming) {
        for (const toEdge of allOutgoing) {
          if (allowedIds.has(toEdge.id)) continue;
          const modes = intersectionModes(desiredModes, fromEdge.modes, toEdge.modes);
          if (modes.length > 0) pairs.push({ from: fromEdge, to: toEdge, modes });
        }
      }
    }

    const ruleIds: string[] = [];
    for (const pair of pairs) {
      const key = `${pair.from.id}\u0000${pair.to.id}\u0000${pair.modes.join(",")}`;
      const existingRuleId = ruleIdByTransition.get(key);
      if (existingRuleId !== undefined) {
        ruleIds.push(existingRuleId);
        continue;
      }
      const ruleId = `turn:osm:${relation.id}:${ruleIds.length}`;
      ruleIdByTransition.set(key, ruleId);
      rules.push({ id: ruleId, via_node_id: viaNodeId, from_edge_id: pair.from.id, to_edge_id: pair.to.id, modes: pair.modes, kind: "forbidden" });
      ruleIds.push(ruleId);
    }
    return { status: "compiled", ruleIds };
  };

  for (const relation of sortedRelations) {
    const tags = relation.tags ?? {};
    const conditionalKey = Object.keys(tags).find((key) => key.startsWith("restriction") && key.endsWith(":conditional"));
    const modeSpecificKey = Object.keys(tags).find((key) => key.startsWith("restriction:") && !key.endsWith(":conditional"));
    const restriction = tags.restriction ?? (conditionalKey === undefined ? undefined : tags[conditionalKey])
      ?? (modeSpecificKey === undefined ? undefined : tags[modeSpecificKey]) ?? "<missing>";

    if (conditionalKey !== undefined) {
      addConcern(relation, restriction, "conditional_without_context", vehicleModes, "conditional restriction requires an explicit local-time evaluation context");
      record(relation, restriction, "unsupported_conditional", vehicleModes);
      continue;
    }

    if (modeSpecificKey !== undefined) {
      const restrictedMode = modeFromRestrictionKey(modeSpecificKey);
      if (restrictedMode === undefined || !supportedValues.has(restriction)) {
        const affected: readonly TravelMode[] = restrictedMode === undefined ? vehicleModes : [restrictedMode];
        addConcern(relation, restriction, "mode_specific_unsupported", affected, `unsupported ${modeSpecificKey}=${restriction}`);
        record(relation, restriction, "unsupported_mode_specific", affected);
        continue;
      }
      const compiled = compileViaNode(relation, restriction, [restrictedMode]);
      if (compiled.status === "compiled") record(relation, restriction, "imported", [restrictedMode], compiled.ruleIds);
      else {
        addConcern(relation, restriction, "unresolved_source_transition", [restrictedMode], `mode-specific relation could not be compiled: ${compiled.status}`);
        record(relation, restriction, compiled.status === "invalid" ? "invalid_member_shape" : compiled.status === "via_way" ? "unsupported_via_way" : "unresolved_way_or_direction", [restrictedMode]);
      }
      continue;
    }

    if (!supportedValues.has(restriction)) {
      record(relation, restriction, "unsupported_restriction_value", vehicleModes);
      continue;
    }

    const members = relationMembers(relation);
    if (members.via.some((member) => member.type === "way")) {
      addConcern(relation, restriction, "via_way_sequence_unsupported", vehicleModes, "via-way restrictions require ordered path-history state not present in graph schema v2");
      record(relation, restriction, "unsupported_via_way", vehicleModes);
      continue;
    }

    const exceptions = parseExceptValues(tags.except);
    let compileModes = [...vehicleModes];
    const ambiguousModes: TravelMode[] = [];
    if (exceptions.length > 0) {
      if (exceptions.includes("bicycle")) compileModes = compileModes.filter((mode) => mode !== "bicycle");
      if (exceptions.some((value) => explicitMotorModeValues.has(value))) compileModes = compileModes.filter((mode) => mode !== "motor_vehicle");
      if (exceptions.some((value) => ambiguousMotorSubmodes.has(value))) {
        compileModes = compileModes.filter((mode) => mode !== "motor_vehicle");
        ambiguousModes.push("motor_vehicle");
      }
      if (ambiguousModes.length > 0) addConcern(relation, restriction, "except_mode_ambiguity", ambiguousModes, `aggregate motor_vehicle mode cannot distinguish exception(s): ${exceptions.join(", ")}`);
    }

    if (compileModes.length === 0) {
      record(relation, restriction, "unsupported_except", ambiguousModes.length > 0 ? ambiguousModes : vehicleModes);
      continue;
    }
    const compiled = compileViaNode(relation, restriction, compileModes);
    if (compiled.status === "invalid") {
      record(relation, restriction, "invalid_member_shape", compileModes);
      continue;
    }
    if (compiled.status === "via_way") {
      addConcern(relation, restriction, "via_way_sequence_unsupported", compileModes, "via-way restrictions require ordered path-history state");
      record(relation, restriction, "unsupported_via_way", compileModes);
      continue;
    }
    if (compiled.status === "unresolved") {
      addConcern(relation, restriction, "unresolved_source_transition", compileModes, "source ways did not resolve to a permitted directed transition");
      record(relation, restriction, "unresolved_way_or_direction", compileModes);
      continue;
    }
    record(relation, restriction, exceptions.length > 0 ? "partially_imported_except" : "imported", [...compileModes, ...ambiguousModes], compiled.ruleIds);
  }

  const dispositions: OsmRestrictionDisposition[] = [
    "imported", "partially_imported_except", "unsupported_conditional", "unsupported_mode_specific", "unsupported_except",
    "unsupported_via_way", "invalid_member_shape", "unsupported_restriction_value", "unresolved_way_or_direction",
  ];
  const dispositionCounts = Object.fromEntries(dispositions.map((value) => [value, results.filter((item) => item.disposition === value).length])) as Record<OsmRestrictionDisposition, number>;
  const restrictionValueCounts = Object.fromEntries([...restrictionCounts.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  rules.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  concerns.sort((left, right) => left.relation_id - right.relation_id || (left.category < right.category ? -1 : left.category > right.category ? 1 : 0));

  return {
    turn_rules: rules,
    concerns,
    audit: {
      relation_count: sortedRelations.length,
      imported_relation_count: dispositionCounts.imported,
      partially_imported_relation_count: dispositionCounts.partially_imported_except,
      generated_turn_rule_count: rules.length,
      concern_count: concerns.length,
      disposition_counts: dispositionCounts,
      restriction_value_counts: restrictionValueCounts,
      relations: results,
    },
  };
}
