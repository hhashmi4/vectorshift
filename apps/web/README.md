# Worldwide map and local routing workspace

The local Next.js application provides worldwide geographic exploration and a routing inspector over the immutable downtown Toronto reference graph. It visualizes actual graph edge geometry and calls the existing graph package on the server; no routing algorithm is duplicated in browser code. Worldwide basemap coverage does not imply worldwide routing or simulation coverage.

From the repository root, first reproduce the ignored graph artifacts, then start the application:

```sh
node tools/data-pipeline/scripts/import-osm.ts
npm run dev:web
```

Open `http://127.0.0.1:3000`. The server refuses non-loopback requests unless `VECTORSHIFT_ALLOW_NONLOCAL=1` is explicitly set; Phase 1C is not a public API.

OpenFreeMap Liberty is the keyless worldwide development default. Configuration is documented in [`.env.example`](.env.example): set `NEXT_PUBLIC_BASEMAP_STYLE_URL=off` for graph-only startup or provide a reviewed vector style override. Terrain is disabled unless a rights-reviewed raster DEM URL and attribution are configured. Any provider must permit the intended use and receive its required attribution; public services must not be treated as an unlimited production SLA. Never place a secret credential in a `NEXT_PUBLIC_*` value. See [map data providers](../../docs/engineering/map-data-providers.md).

The city control moves the camera to World, Toronto, Welland, or Niagara Falls. Toronto is labeled `Experimental graph`; the other presets are currently `No available graph`. A future region may be labeled `Qualified graph` only from accepted publication evidence. Rotation, pitch, optional terrain, and provider-supplied building extrusions are rendering state and cannot alter graph connectivity.

The graph and routing-support sidecar come from the pinned OSM source manifest and are generated into ignored `data/derived/` files. The server checks both publication digests before constructing the routing index; custom artifact paths require matching digest configuration. Road data remains © OpenStreetMap contributors under ODbL. Traversal costs are deterministic synthetic free-flow weights, not observed traffic or traffic predictions.

This application does not own authoritative scenario/run state, simulation/routing algorithms, cloud credentials, or private administrative functionality. Additional GPU layers require measured justification under [ADR 0002](../../docs/adr/0002-maplibre-pmtiles.md).

Run `npm run typecheck:web`, `npm run test:web`, `npm run build:web`, and—where system Chrome is available—`npm run test:web:e2e`. Read [the UI specification](../../docs/product/ui-design.md) and the local [AGENTS.md](AGENTS.md) before changing the workspace.

Next.js 16.4.5 regenerates `next-env.d.ts` for development, type generation, and production builds with environment-specific `.next` paths. It is intentionally ignored. Always run the existing `next typegen`-backed typecheck instead of editing or staging that declaration.
