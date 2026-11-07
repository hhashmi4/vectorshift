import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium, type Page } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROME_PATH;
if (!executablePath) throw new Error("PLAYWRIGHT_CHROME_PATH is required; visual verification never downloads a browser");
const baseUrl = process.env.VECTORSHIFT_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = resolve(process.cwd(), "../..", process.env.VECTORSHIFT_VISUAL_OUTPUT ?? "artifacts/phase1d");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

async function prepareRoute(page: Page): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="routing-map"][data-map-ready="true"]').waitFor({ state: "attached" });
  await page.getByRole("button", { name: "Reference pair" }).click();
  await page.getByRole("button", { name: "Compute route" }).click();
  await page.getByTestId("route-result").waitFor({ state: "visible" });
  await page.waitForTimeout(1_500);
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
await prepareRoute(desktop);
await desktop.screenshot({ path: resolve(outputDirectory, "desktop-route.png"), fullPage: false });
await desktop.getByRole("button", { name: "Layers" }).click();
await desktop.getByLabel("Worldwide vector basemap").uncheck();
await desktop.waitForTimeout(250);
await desktop.screenshot({ path: resolve(outputDirectory, "desktop-graph-only.png"), fullPage: false });
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", deviceScaleFactor: 1 });
await prepareRoute(mobile);
await mobile.screenshot({ path: resolve(outputDirectory, "mobile-route.png"), fullPage: false });

console.log(JSON.stringify({ output_directory: outputDirectory, screenshots: ["desktop-route.png", "desktop-graph-only.png", "mobile-route.png"] }, null, 2));
await browser.close();
