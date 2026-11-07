import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    reducedMotion: "reduce",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_BASEMAP_STYLE_URL: "http://127.0.0.1:3000/__fixtures__/world-style.json",
      NEXT_PUBLIC_BASEMAP_ATTRIBUTION: "Hermetic browser-test basemap",
      NEXT_PUBLIC_TERRAIN_TILES_URL: "http://127.0.0.1:3000/__fixtures__/terrain/{z}/{x}/{y}.png",
      NEXT_PUBLIC_TERRAIN_ATTRIBUTION: "Hermetic browser-test DEM",
    },
  },
});
