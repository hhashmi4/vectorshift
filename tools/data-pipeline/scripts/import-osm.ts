import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import {
  analyzeRoadGraph,
  graphSha256,
  graphStatistics,
  importOsmOverpassRoadGraph,
  routingSupportSha256,
  serializeRoadGraph,
  serializeRoutingSupportArtifact,
  type GraphDatasetMetadata,
  type OsmOverpassDocument,
} from "../../../packages/graph/src/index.ts";

interface AcquisitionManifest {
  readonly dataset_id: string;
  readonly dataset_version: string;
  readonly source: string;
  readonly source_url: string;
  readonly acquired_at: string;
  readonly snapshot_at: string;
  readonly bounds: { readonly south: number; readonly west: number; readonly north: number; readonly east: number };
  readonly content_sha256: string;
  readonly raw_local_path: string;
  readonly pipeline_version: string;
  readonly license: string;
  readonly attribution: string;
}

const root = process.cwd();
const manifestPath = resolve(root, process.argv[2] ?? "data/manifests/toronto-downtown-2026-11-05-pipeline3.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as AcquisitionManifest;
const rawPath = resolve(root, manifest.raw_local_path);
const rawBytes = await readFile(rawPath);
const sourceDigest = createHash("sha256").update(rawBytes).digest("hex");
if (sourceDigest !== manifest.content_sha256) {
  throw new Error(`source content digest mismatch: expected ${manifest.content_sha256}, calculated ${sourceDigest}`);
}

const dataset: GraphDatasetMetadata = {
  dataset_id: manifest.dataset_id,
  dataset_version: manifest.dataset_version,
  source: {
    provider: manifest.source,
    source_uri: manifest.source_url,
    license: manifest.license,
    attribution: manifest.attribution,
    acquired_at: manifest.acquired_at,
    snapshot_at: manifest.snapshot_at,
    bounds: {
      south_e7: Math.round(manifest.bounds.south * 10_000_000),
      west_e7: Math.round(manifest.bounds.west * 10_000_000),
      north_e7: Math.round(manifest.bounds.north * 10_000_000),
      east_e7: Math.round(manifest.bounds.east * 10_000_000),
    },
    source_sha256: manifest.content_sha256,
    pipeline_version: manifest.pipeline_version,
  },
};

const document = JSON.parse(rawBytes.toString("utf8")) as OsmOverpassDocument;
const startedAt = performance.now();
const result = importOsmOverpassRoadGraph(document, dataset);
const importDurationMs = performance.now() - startedAt;
const serialized = serializeRoadGraph(result.graph);
const graphDigest = graphSha256(result.graph);
const supportArtifact = {
  format: "vectorshift-routing-support" as const,
  artifact_version: 1 as const,
  graph_sha256: graphDigest,
  source_sha256: sourceDigest,
  pipeline_version: manifest.pipeline_version,
  u_turn_policy: "source_rules_only" as const,
  concerns: result.restriction_concerns,
  restriction_audit: result.restriction_audit,
};
const serializedSupport = serializeRoutingSupportArtifact(supportArtifact);
const outputPath = resolve(root, `data/derived/${manifest.dataset_version}.road-graph.json`);
const temporaryPath = `${outputPath}.partial`;
await mkdir(dirname(outputPath), { recursive: true });
let outputStatus = "verified-existing";
try {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== serialized) throw new Error(`refusing to overwrite non-matching graph artifact: ${outputPath}`);
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  await rm(temporaryPath, { force: true });
  await writeFile(temporaryPath, serialized, { flag: "wx" });
  await copyFile(temporaryPath, outputPath, constants.COPYFILE_EXCL);
  await rm(temporaryPath, { force: true });
  outputStatus = "created";
}
const supportOutputPath = resolve(root, `data/derived/${manifest.dataset_version}.routing-support.json`);
const supportTemporaryPath = `${supportOutputPath}.partial`;
let supportOutputStatus = "verified-existing";
try {
  const existing = await readFile(supportOutputPath, "utf8");
  if (existing !== serializedSupport) throw new Error(`refusing to overwrite non-matching routing support artifact: ${supportOutputPath}`);
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  await rm(supportTemporaryPath, { force: true });
  await writeFile(supportTemporaryPath, serializedSupport, { flag: "wx" });
  await copyFile(supportTemporaryPath, supportOutputPath, constants.COPYFILE_EXCL);
  await rm(supportTemporaryPath, { force: true });
  supportOutputStatus = "created";
}

const warningCounts = Object.fromEntries(
  [...new Set(result.warnings.map((warning) => warning.code))]
    .sort()
    .map((code) => [code, result.warnings.filter((warning) => warning.code === code).length]),
);
const allModeAnalysis = analyzeRoadGraph(result.graph);
const motorAnalysis = analyzeRoadGraph(result.graph, "motor_vehicle");
const componentSummary = (components: readonly { readonly node_count: number }[]) => ({
  count: components.length,
  largest_sizes: components.slice(0, 20).map((component) => component.node_count),
});
const boundarySummary = (boundary: typeof allModeAnalysis.boundary) => ({
  tolerance_e7: boundary.tolerance_e7,
  nodes_outside_declared_bounds_count: boundary.nodes_outside_declared_bounds.length,
  nodes_near_boundary_count: boundary.nodes_near_boundary.length,
  near_boundary_dead_end_node_count: boundary.near_boundary_dead_end_nodes.length,
  components_touching_boundary_count: boundary.components_touching_boundary.length,
});

console.log(JSON.stringify({
  manifest_path: process.argv[2] ?? "data/manifests/toronto-downtown-2026-11-05-pipeline3.json",
  source_sha256: sourceDigest,
  graph_sha256: graphDigest,
  output_path: `data/derived/${manifest.dataset_version}.road-graph.json`,
  output_status: outputStatus,
  output_bytes: Buffer.byteLength(serialized),
  routing_support_path: `data/derived/${manifest.dataset_version}.routing-support.json`,
  routing_support_status: supportOutputStatus,
  routing_support_sha256: routingSupportSha256(supportArtifact),
  routing_support_bytes: Buffer.byteLength(serializedSupport),
  import_duration_ms: importDurationMs,
  source_highway_way_count: result.source_highway_way_count,
  source_restriction_relation_count: result.source_restriction_relation_count,
  restriction_audit: {
    imported_relation_count: result.restriction_audit.imported_relation_count,
    partially_imported_relation_count: result.restriction_audit.partially_imported_relation_count,
    generated_turn_rule_count: result.restriction_audit.generated_turn_rule_count,
    concern_count: result.restriction_audit.concern_count,
    disposition_counts: result.restriction_audit.disposition_counts,
    restriction_value_counts: result.restriction_audit.restriction_value_counts,
  },
  warning_counts: warningCounts,
  statistics: graphStatistics(result.graph),
  analysis: {
    all_modes: {
      weak_components: componentSummary(allModeAnalysis.weak_components),
      strong_components: componentSummary(allModeAnalysis.strong_components),
      isolated_node_count: allModeAnalysis.isolated_node_ids.length,
      boundary: boundarySummary(allModeAnalysis.boundary),
    },
    motor_vehicle: {
      eligible_edge_count: motorAnalysis.eligible_edge_ids.length,
      weak_components: componentSummary(motorAnalysis.weak_components),
      strong_components: componentSummary(motorAnalysis.strong_components),
      isolated_node_count: motorAnalysis.isolated_node_ids.length,
      boundary: boundarySummary(motorAnalysis.boundary),
    },
  },
}, null, 2));
