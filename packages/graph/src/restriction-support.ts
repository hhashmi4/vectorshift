import { createHash } from "node:crypto";
import type { OsmRestrictionAudit, OsmRestrictionConcern } from "./osm-restrictions.ts";

export interface RoutingSupportArtifact {
  readonly format: "vectorshift-routing-support";
  readonly artifact_version: 1;
  readonly graph_sha256: string;
  readonly source_sha256: string;
  readonly pipeline_version: string;
  readonly u_turn_policy: "source_rules_only";
  readonly concerns: readonly OsmRestrictionConcern[];
  readonly restriction_audit: OsmRestrictionAudit;
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, stableJsonValue(child)]));
  }
  return value;
}

export function serializeRoutingSupportArtifact(artifact: RoutingSupportArtifact): string {
  return `${JSON.stringify(stableJsonValue(artifact))}\n`;
}

export function routingSupportSha256(artifact: RoutingSupportArtifact): string {
  return createHash("sha256").update(serializeRoutingSupportArtifact(artifact)).digest("hex");
}

export function deserializeRoutingSupportArtifact(serialized: string | Uint8Array): RoutingSupportArtifact {
  const source = typeof serialized === "string" ? serialized : new TextDecoder().decode(serialized);
  const parsed: unknown = JSON.parse(source);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid routing support artifact");
  const artifact = parsed as Partial<RoutingSupportArtifact>;
  if (artifact.format !== "vectorshift-routing-support" || artifact.artifact_version !== 1) throw new Error("unsupported routing support artifact");
  if (typeof artifact.graph_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.graph_sha256)) throw new Error("invalid routing support graph digest");
  if (typeof artifact.source_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.source_sha256)) throw new Error("invalid routing support source digest");
  if (typeof artifact.pipeline_version !== "string" || artifact.pipeline_version.length === 0) throw new Error("invalid routing support pipeline version");
  if (artifact.u_turn_policy !== "source_rules_only" || !Array.isArray(artifact.concerns) || artifact.restriction_audit === undefined) {
    throw new Error("invalid routing support semantics");
  }
  return artifact as RoutingSupportArtifact;
}
