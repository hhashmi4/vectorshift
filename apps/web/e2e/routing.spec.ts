import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
