# Local routing map

Phase 1C provides a local-only Next.js routing inspector over the immutable downtown Toronto graph. It visualizes actual graph edge geometry and calls the existing graph package on the server; no routing algorithm is duplicated in browser code.

From the repository root, first reproduce the ignored graph artifacts, then start the application:

```sh
node tools/data-pipeline/scripts/import-osm.ts
npm run dev:web
```

Open `http://127.0.0.1:3000`. The server refuses non-loopback requests unless `VECTORSHIFT_ALLOW_NONLOCAL=1` is explicitly set; Phase 1C is not a public API.

Configuration is documented in [`.env.example`](.env.example). `NEXT_PUBLIC_BASEMAP_STYLE_URL` is optional. Without it the application uses a blank MapLibre style and still renders the actual road graph. Any configured provider must permit the intended use and must receive its required attribution; public tile services must not be treated as unlimited. Never place a secret credential in a `NEXT_PUBLIC_*` value.

The graph and routing-support sidecar come from the pinned OSM source manifest and are generated into ignored `data/derived/` files. The server checks both publication digests before constructing the routing index; custom artifact paths require matching digest configuration. Road data remains © OpenStreetMap contributors under ODbL. Traversal costs are deterministic synthetic free-flow weights, not observed traffic or traffic predictions.

This application does not own authoritative scenario/run state, simulation/routing algorithms, cloud credentials, or private administrative functionality. Additional GPU layers require measured justification under [ADR 0002](../../docs/adr/0002-maplibre-pmtiles.md).

Run `npm run typecheck:web`, `npm run test:web`, `npm run build:web`, and—where system Chrome is available—`npm run test:web:e2e`. Read [the UI specification](../../docs/product/ui-design.md) and the local [AGENTS.md](AGENTS.md) before changing the workspace.

Next.js 16.4.5 regenerates `next-env.d.ts` for development, type generation, and production builds with environment-specific `.next` paths. It is intentionally ignored. Always run the existing `next typegen`-backed typecheck instead of editing or staging that declaration.
