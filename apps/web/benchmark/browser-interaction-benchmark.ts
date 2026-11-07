import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

function percentile(sorted: readonly number[], quantile: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0;
}

const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
if (!executablePath) throw new Error("PLAYWRIGHT_CHROME_PATH is required; the benchmark never downloads a browser");
const baseUrl = process.env.VECTORSHIFT_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000";
const sampleCount = Number(process.env.VECTORSHIFT_BROWSER_BENCHMARK_SAMPLES ?? "30");
if (!Number.isSafeInteger(sampleCount) || sampleCount < 20) throw new Error("VECTORSHIFT_BROWSER_BENCHMARK_SAMPLES must be an integer of at least 20");

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
const page = await context.newPage();
const navigationStarted = performance.now();
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.getByTestId("route-status").waitFor({ state: "visible" });
await page.locator('[data-testid="routing-map"][data-map-ready="true"]').waitFor({ state: "attached" });
const readyMs = performance.now() - navigationStarted;

await page.evaluate(() => {
  const scope = globalThis as typeof globalThis & { __vectorshiftLongTasks?: number[] };
  scope.__vectorshiftLongTasks = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) scope.__vectorshiftLongTasks?.push(entry.duration);
  }).observe({ type: "longtask", buffered: true });
  (globalThis as typeof globalThis & { gc?: () => void }).gc?.();
});
const heapBefore = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);

await page.getByRole("button", { name: "Reference pair" }).click();
const interactionMs: number[] = [];
for (let sample = 0; sample < sampleCount; sample += 1) {
  const started = performance.now();
  if (sample === 0) {
    await page.getByRole("button", { name: "Compute route" }).click();
  } else {
    await page.getByLabel("Algorithm").selectOption(sample % 2 === 0 ? "astar" : "dijkstra");
  }
  await page.getByTestId("route-result").waitFor({ state: "visible" });
  interactionMs.push(performance.now() - started);
}

const mapBox = await page.getByTestId("routing-map").boundingBox();
if (!mapBox) throw new Error("map did not produce a measurable viewport");
for (let sample = 0; sample < 20; sample += 1) {
  const x = mapBox.x + mapBox.width * 0.45;
  const y = mapBox.y + mapBox.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (sample % 2 === 0 ? 28 : -28), y + 12, { steps: 4 });
  await page.mouse.up();
}
await page.waitForTimeout(250);
await page.evaluate(() => (globalThis as typeof globalThis & { gc?: () => void }).gc?.());
const browserEvidence = await page.evaluate(() => {
  const scope = globalThis as typeof globalThis & { __vectorshiftLongTasks?: number[] };
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return {
    used_js_heap_bytes: memory?.usedJSHeapSize ?? null,
    resource_transfer_bytes: resources.reduce((total, entry) => total + entry.transferSize, 0),
    resource_encoded_body_bytes: resources.reduce((total, entry) => total + entry.encodedBodySize, 0),
    resource_count: resources.length,
    long_tasks_ms: scope.__vectorshiftLongTasks ?? [],
  };
});

interactionMs.sort((left, right) => left - right);
browserEvidence.long_tasks_ms.sort((left, right) => left - right);
const result = {
  benchmark_version: 1,
  generated_at: new Date().toISOString(),
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    browser: await page.evaluate(() => navigator.userAgent),
    viewport_css_px: { width: 1440, height: 960 },
    server: "Next.js production build over loopback",
  },
  methodology: {
    route_samples: sampleCount,
    route_workload: "one deterministic supported pair; alternate A* and Dijkstra after one explicit compute",
    pan_gestures: 20,
    reduced_motion: true,
    interpretation: "headless local interaction baseline; not an FPS, GPU, field-user, or city-scale result",
  },
  graph_ready_ms: readyMs,
  route_interaction_ms: {
    median: percentile(interactionMs, 0.5),
    p95: percentile(interactionMs, 0.95),
    p99: percentile(interactionMs, 0.99),
    maximum: interactionMs.at(-1) ?? 0,
  },
  resources: {
    count: browserEvidence.resource_count,
    transfer_bytes: browserEvidence.resource_transfer_bytes,
    encoded_body_bytes: browserEvidence.resource_encoded_body_bytes,
  },
  memory: {
    used_js_heap_before_bytes: heapBefore,
    used_js_heap_after_bytes: browserEvidence.used_js_heap_bytes,
    delta_bytes: heapBefore === null || browserEvidence.used_js_heap_bytes === null ? null : browserEvidence.used_js_heap_bytes - heapBefore,
    caveat: "Chromium performance.memory after explicit GC; directional leak signal only, not total renderer/GPU/RSS",
  },
  long_tasks: {
    count: browserEvidence.long_tasks_ms.length,
    maximum_ms: browserEvidence.long_tasks_ms.at(-1) ?? 0,
    total_ms: browserEvidence.long_tasks_ms.reduce((total, value) => total + value, 0),
    caveat: "PerformanceObserver long tasks during routing and scripted pan gestures; headless timing is not visual smoothness proof",
  },
};

const outputArgument = process.argv.indexOf("--output");
if (outputArgument >= 0) {
  const output = process.argv[outputArgument + 1];
  if (!output) throw new Error("--output requires a path");
  const outputPath = resolve(process.cwd(), "../..", output);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
await browser.close();
