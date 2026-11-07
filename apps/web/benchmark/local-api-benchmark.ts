import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import process from "node:process";

interface RouteResponse {
  readonly status: string;
  readonly diagnostics?: { readonly server_compute_ms?: number };
  readonly graph_sha256?: string;
}

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? 0;
}

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else files.push(child);
  }
  return files;
}

const root = resolve(process.cwd(), "../..");
const baseUrl = process.env.VECTORSHIFT_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000";
const sampleCount = Number(process.env.VECTORSHIFT_BENCHMARK_SAMPLES ?? "200");
if (!Number.isSafeInteger(sampleCount) || sampleCount < 100) throw new Error("VECTORSHIFT_BENCHMARK_SAMPLES must be an integer of at least 100");

const networkStarted = performance.now();
const networkResponse = await fetch(`${baseUrl}/api/network?mode=motor_vehicle`);
const networkBytes = new Uint8Array(await networkResponse.arrayBuffer());
const networkLatencyMs = performance.now() - networkStarted;
if (!networkResponse.ok) throw new Error(`network endpoint returned ${networkResponse.status}`);
const network = JSON.parse(new TextDecoder().decode(networkBytes)) as {
  readonly graph: { readonly graph_sha256: string };
  readonly suggested_pair: { readonly start_node_id: string; readonly destination_node_id: string } | null;
};
if (network.suggested_pair === null) throw new Error("network endpoint did not provide a supported reference pair");

const request = (algorithm: "dijkstra" | "astar") => ({
  ...network.suggested_pair,
  mode: "motor_vehicle",
  algorithm,
});
for (let warmup = 0; warmup < 10; warmup += 1) {
  await fetch(`${baseUrl}/api/route`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request(warmup % 2 === 0 ? "dijkstra" : "astar")) });
}

const roundTrip: number[] = [];
const serverCompute: number[] = [];
const statusCounts: Record<string, number> = {};
for (let sample = 0; sample < sampleCount; sample += 1) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request(sample % 2 === 0 ? "dijkstra" : "astar")),
  });
  const body = await response.json() as RouteResponse;
  roundTrip.push(performance.now() - started);
  if (typeof body.diagnostics?.server_compute_ms === "number") serverCompute.push(body.diagnostics.server_compute_ms);
  statusCounts[body.status] = (statusCounts[body.status] ?? 0) + 1;
}
roundTrip.sort((left, right) => left - right);
serverCompute.sort((left, right) => left - right);

const staticRoot = resolve(process.cwd(), ".next/static");
const staticFiles = (await filesUnder(staticRoot)).filter((file) => [".js", ".css"].includes(extname(file)));
let staticBytes = 0;
let staticGzipBytes = 0;
for (const file of staticFiles) {
  const bytes = await readFile(file);
  staticBytes += (await stat(file)).size;
  staticGzipBytes += gzipSync(bytes).byteLength;
}

const result = {
  benchmark_version: 1,
  generated_at: new Date().toISOString(),
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    cpu_model: process.env.VECTORSHIFT_BENCHMARK_CPU ?? "Apple M4",
    server: "next start production build, loopback HTTP/1.1",
  },
  methodology: {
    sample_count: sampleCount,
    warmup_count: 10,
    algorithms: "alternating Dijkstra and A* against one deterministic supported reference pair",
    concurrency: 1,
    interpretation: "local loopback baseline only; not a city-scale, network, or browser-frame benchmark",
  },
  graph_sha256: network.graph.graph_sha256,
  network_endpoint: {
    cold_process_request_ms: networkLatencyMs,
    response_bytes: networkBytes.byteLength,
    response_sha256: createHash("sha256").update(networkBytes).digest("hex"),
  },
  route_endpoint: {
    status_counts: statusCounts,
    round_trip_ms: {
      median: percentile(roundTrip, 0.5),
      p95: percentile(roundTrip, 0.95),
      p99: percentile(roundTrip, 0.99),
      maximum: roundTrip.at(-1) ?? 0,
    },
    server_compute_ms: {
      median: percentile(serverCompute, 0.5),
      p95: percentile(serverCompute, 0.95),
      p99: percentile(serverCompute, 0.99),
      maximum: serverCompute.at(-1) ?? 0,
    },
  },
  production_build: {
    emitted_static_js_css_file_count: staticFiles.length,
    emitted_static_js_css_bytes: staticBytes,
    emitted_static_js_css_gzip_bytes: staticGzipBytes,
    caveat: "All emitted static JS/CSS chunks, not a per-route transfer measurement; browser caching and compression headers are excluded.",
  },
};

const outputArgument = process.argv.indexOf("--output");
if (outputArgument >= 0) {
  const output = process.argv[outputArgument + 1];
  if (output === undefined) throw new Error("--output requires a path");
  await writeFile(resolve(root, output), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
