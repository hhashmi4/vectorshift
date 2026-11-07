import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const browserStyleFixture = {
  version: 8,
  sources: {
    context: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { kind: "water" }, geometry: { type: "Polygon", coordinates: [[[-79.5, 43.5], [-79.3, 43.5], [-79.3, 43.58], [-79.5, 43.58], [-79.5, 43.5]]] } },
          { type: "Feature", properties: { kind: "park" }, geometry: { type: "Polygon", coordinates: [[[-79.39, 43.645], [-79.385, 43.645], [-79.385, 43.65], [-79.39, 43.65], [-79.39, 43.645]]] } },
          { type: "Feature", properties: { kind: "road" }, geometry: { type: "LineString", coordinates: [[-79.39, 43.646], [-79.37, 43.651]] } },
          { type: "Feature", properties: { kind: "building", render_height: 42, render_min_height: 0 }, geometry: { type: "Polygon", coordinates: [[[-79.382, 43.647], [-79.3815, 43.647], [-79.3815, 43.6475], [-79.382, 43.6475], [-79.382, 43.647]]] } },
        ],
      },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#dfe8eb" } },
    { id: "water", type: "fill", source: "context", filter: ["==", ["get", "kind"], "water"], paint: { "fill-color": "#90c7d8" } },
    { id: "park", type: "fill", source: "context", filter: ["==", ["get", "kind"], "park"], paint: { "fill-color": "#9fc7a2" } },
    { id: "road", type: "line", source: "context", filter: ["==", ["get", "kind"], "road"], paint: { "line-color": "#ffffff", "line-width": 3 } },
    { id: "building", type: "fill", source: "context", filter: ["==", ["get", "kind"], "building"], paint: { "fill-color": "#aab4ba" } },
    { id: "building-3d", type: "fill-extrusion", source: "context", filter: ["==", ["get", "kind"], "building"], paint: { "fill-extrusion-color": "#87949c", "fill-extrusion-height": ["get", "render_height"], "fill-extrusion-base": ["get", "render_min_height"], "fill-extrusion-opacity": 0.8 } },
  ],
};

const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test.beforeEach(async ({ page }) => {
  await page.route("**/__fixtures__/world-style.json", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(browserStyleFixture) }));
  await page.route("**/__fixtures__/terrain/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: transparentPng }));
});

async function expectSelectedLocation(page: Page, preset: "world" | "toronto" | "welland" | "niagara-falls", coverage: "Experimental graph" | "No available graph"): Promise<void> {
  await expect(page.getByLabel("Go to")).toHaveValue(preset);
  await expect(page.getByTestId("graph-coverage-status")).toHaveText(coverage);
  await expect(page.getByTestId("coverage-scope")).toHaveText("Selected location");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-active-preset", preset);
}

async function expectNavigationSettled(page: Page, longitude: string, latitude: string): Promise<void> {
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-navigation-state", "settled");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-center-longitude", longitude);
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-center-latitude", latitude);
}

test("loads the actual graph, computes a route, and exposes non-map evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inspect a legal graph path" })).toBeVisible();
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await expect(page.getByTestId("routing-map").locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "Reference pair" }).click();
  const start = await page.getByLabel("Start node").inputValue();
  const destination = await page.getByLabel("Destination node").inputValue();
  expect(start).toMatch(/^node:osm:/);
  expect(destination).toMatch(/^node:osm:/);

  await page.getByRole("button", { name: "Compute route" }).click();
  await expect(page.getByTestId("route-result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("route-status")).toContainText(/ordered graph edges|configured core buffer/);
  await expect(page.getByText("Synthetic free-flow cost")).toBeVisible();
});

test("Toronto to Welland changes selected coverage before the animated camera settles", async ({ page }) => {
  await page.goto("/");
  await expectSelectedLocation(page, "toronto", "Experimental graph");

  await page.getByLabel("Go to").selectOption("welland");
  await expectSelectedLocation(page, "welland", "No available graph");
  await expect(page.getByTestId("coverage-detail")).toContainText("no prepared routing or simulation graph");
  await expectNavigationSettled(page, "-79.2483", "42.9922");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-viewport-coverage", "none");
});

test("Welland to Niagara Falls retains no-graph coverage across camera movement", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Go to").selectOption("welland");
  await expectNavigationSettled(page, "-79.2483", "42.9922");

  await page.getByLabel("Go to").selectOption("niagara-falls");
  await expectSelectedLocation(page, "niagara-falls", "No available graph");
  await expectNavigationSettled(page, "-79.0849", "43.0896");
});

test("rapid Toronto, Welland, Toronto navigation cannot publish stale coverage", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Go to").selectOption("welland");
  await expectSelectedLocation(page, "welland", "No available graph");
  await page.getByLabel("Go to").selectOption("toronto");
  await expectSelectedLocation(page, "toronto", "Experimental graph");
  await expectNavigationSettled(page, "-79.3805", "43.6482");
});

test("a newer city selection supersedes an interrupted camera animation", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Go to").selectOption("welland");
  await page.getByLabel("Go to").selectOption("niagara-falls");
  await expectSelectedLocation(page, "niagara-falls", "No available graph");
  await expectNavigationSettled(page, "-79.0849", "43.0896");
});

test("reduced-motion city navigation resolves coverage and camera synchronously", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Go to").selectOption("world");
  await expectSelectedLocation(page, "world", "No available graph");
  await expectNavigationSettled(page, "0.0000", "20.0000");
});

test("basemap reload during navigation preserves selected coverage and completes the camera", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByLabel("Go to").selectOption("welland");
  await expectSelectedLocation(page, "welland", "No available graph");
  await page.getByLabel("Worldwide vector basemap").uncheck();
  await expect(page.getByTestId("basemap-status")).toHaveText("Graph-only fallback");
  await expectNavigationSettled(page, "-79.2483", "42.9922");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-overlays-ready", "true");
});

test("component cleanup invalidates pending camera navigation", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Go to").selectOption("welland");
  await expectSelectedLocation(page, "welland", "No available graph");
  await page.goto("about:blank");
  await expect(page.locator("body")).toBeEmpty();
  expect(pageErrors).toEqual([]);
});

test("terrain and camera controls are optional and honor explicit user action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await page.getByRole("button", { name: "Reference pair" }).click();
  await page.getByRole("button", { name: "Compute route" }).click();
  await expect(page.getByTestId("route-result")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Layers" }).click();
  await expect(page.getByTestId("terrain-status")).toHaveText("Rights-reviewed source configured");
  await expect(page.getByTestId("buildings-status")).toHaveText("Provider height data only");
  await page.getByLabel("3D buildings").uncheck();
  await page.getByLabel("3D buildings").check();
  await page.getByLabel("3D terrain").check();
  await expect(page.getByTestId("terrain-status")).toHaveText("DEM enabled");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-terrain-state", "enabled");
  await page.getByRole("button", { name: "Pitch and rotate camera" }).click();
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-pitch", "55.0");
  await expect(page.getByTestId("route-result")).toBeVisible();
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-overlays-ready", "true");
  await page.getByLabel("3D terrain").uncheck();
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-terrain-state", "off");
});

test("style reloads preserve authoritative graph and route overlays", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await page.getByRole("button", { name: "Reference pair" }).click();
  await page.getByRole("button", { name: "Compute route" }).click();
  await expect(page.getByTestId("route-result")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Layers" }).click();
  await page.getByLabel("Worldwide vector basemap").uncheck();
  await expect(page.getByTestId("basemap-status")).toHaveText("Graph-only fallback");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-overlays-ready", "true");
  await expect(page.getByTestId("route-result")).toBeVisible();

  await page.getByLabel("Worldwide vector basemap").check();
  await expect(page.getByTestId("basemap-status")).toHaveText("Vector context loaded");
  await expect(page.getByTestId("routing-map")).toHaveAttribute("data-overlays-ready", "true");
  await expect(page.getByTestId("route-result")).toBeVisible();
});

test("swapping endpoints recalculates the actual reverse query", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await page.getByRole("button", { name: "Reference pair" }).click();
  const originalStart = await page.getByLabel("Start node").inputValue();
  const originalDestination = await page.getByLabel("Destination node").inputValue();
  await page.getByRole("button", { name: "Compute route" }).click();
  await expect(page.getByTestId("route-result")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Swap" }).click();
  await expect(page.getByLabel("Start node")).toHaveValue(originalDestination);
  await expect(page.getByLabel("Destination node")).toHaveValue(originalStart);
  await expect(page.getByTestId("route-result")).toBeVisible({ timeout: 20_000 });
});

test("a newer algorithm request cancels and supersedes a stale response", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await page.getByRole("button", { name: "Reference pair" }).click();
  await page.route("**/api/route", async (interception) => {
    const request = interception.request().postDataJSON() as { algorithm: "astar" | "dijkstra" };
    if (request.algorithm === "astar") await new Promise((resolve) => setTimeout(resolve, 350));
    await interception.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "found",
        edge_path: [request.algorithm],
        geometry: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-79.38, 43.648], [-79.379, 43.649]] } },
        cost_ms: request.algorithm === "astar" ? 111 : 222,
        distance_mm: request.algorithm === "astar" ? 111_000 : 222_000,
        algorithm: request.algorithm,
        mode: "motor_vehicle",
        graph_sha256: "fixture-sha",
        dataset_version: "fixture-version",
        boundary: { status: "supported", minimum_boundary_distance_mm: 250_000, message: "Fixture supported." },
        diagnostics: { states_expanded: 2, queue_pushes: 3, server_compute_ms: 0.25, u_turn_policy: "source_rules_only" },
      }),
    });
  });

  await page.getByRole("button", { name: "Compute route" }).click();
  await page.getByLabel("Algorithm").selectOption("dijkstra");
  await expect(page.getByTestId("route-cost")).toContainText("0.2", { timeout: 10_000 });
  await expect(page.getByTestId("route-distance")).toContainText("0.22");
  await page.waitForTimeout(450);
  await expect(page.getByTestId("route-cost")).toContainText("0.2");
});

test("failed vector style falls back to the authoritative graph-only map", async ({ page }) => {
  await page.unroute("**/__fixtures__/world-style.json");
  await page.route("**/__fixtures__/world-style.json", async (route) => route.fulfill({ status: 503, contentType: "text/plain", body: "fixture unavailable" }));
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText(/selectable|graph-only view/, { timeout: 20_000 });
  await page.getByRole("button", { name: "Layers" }).click();
  await expect(page.getByTestId("basemap-status")).toHaveText("Graph-only fallback");
  await expect(page.getByTestId("routing-map").locator("canvas")).toBeVisible();
});

test("primary workflow has no automatically detectable WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("network failure produces an explicit recoverable error state", async ({ page }) => {
  await page.route("**/api/network?mode=*", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Fixture graph unavailable." }) }));
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toHaveText("Fixture graph unavailable.");
  await expect(page.getByRole("button", { name: "Compute route" })).toBeDisabled();
});

test("unsupported restriction semantics are explicit and never render route evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("route-status")).toContainText("selectable", { timeout: 20_000 });
  await page.getByRole("button", { name: "Reference pair" }).click();
  await page.route("**/api/route", async (route) => route.fulfill({
    status: 422,
    contentType: "application/json",
    body: JSON.stringify({
      status: "unsupported",
      reason: "restriction_semantics",
      message: "The candidate path intersects unsupported source semantics.",
      relation_ids: [99],
      categories: ["via_way_sequence_unsupported"],
      graph_sha256: "fixture",
      dataset_version: "fixture",
    }),
  }));
  await page.getByRole("button", { name: "Compute route" }).click();
  await expect(page.getByTestId("unsupported-detail")).toContainText("99");
  await expect(page.getByTestId("route-result")).toHaveCount(0);
});
