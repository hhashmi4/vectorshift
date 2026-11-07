import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { RoutingIndex, deserializeRoadGraph } from "../../../packages/graph/src/index.ts";

const path = process.argv[2];
if (path === undefined) throw new Error("usage: node --expose-gc measure-graph-memory.ts <graph-artifact>");
global.gc?.();
const before = process.memoryUsage();
const started = performance.now();
const bytes = await readFile(resolve(process.cwd(), path));
const graph = deserializeRoadGraph(bytes);
const index = new RoutingIndex(graph);
void index;
global.gc?.();
const after = process.memoryUsage();
console.log(JSON.stringify({
  artifact_path: path,
  artifact_bytes: bytes.byteLength,
  dataset_version: graph.dataset.dataset_version,
  node_count: graph.nodes.length,
  edge_count: graph.edges.length,
  load_and_index_ms: performance.now() - started,
  memory_before_bytes: before,
  memory_after_bytes: after,
  retained_delta_bytes: {
    rss: after.rss - before.rss,
    heap_used: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
    array_buffers: after.arrayBuffers - before.arrayBuffers,
  },
}, null, 2));
