# Local development

## Supported baseline

- macOS ARM64 is the first local platform.
- Node.js 24.x is required for JavaScript/TypeScript work.
- TypeScript `7.0.2` and Node declarations `24.19.2` are exact local development dependencies. Node 24 executes erasable TypeScript directly; the compiler provides strict static verification.
- Python dependencies are not yet selected. Python 3.13 is the initial compatibility baseline for simulation dependency evaluation; Python 3.14 is an additional target only after every direct and transitive native dependency is proven compatible.

The choice of Python 3.13 is a risk-control proposal, not evidence that 3.14 is incompatible. Record package/version/wheel availability and build/test results before selecting an interpreter in the simulation lockfile and container.

## Repository setup

```sh
git clone <repository-url>
cd vectorshift
npm ci
npm run check
```

Graph and routing commands:

```sh
npm run test:graph
npm run benchmark:graph
npm run benchmark:routing
```

The graph import and benchmarks require the ignored raw Toronto acquisition at the path recorded in its committed manifest. They never download data automatically.

Local routing map:

```sh
node tools/data-pipeline/scripts/import-osm.ts
npm run dev:web
```

Open `http://127.0.0.1:3000`. This is the single local start command after artifact generation. The server binds loopback and rejects non-loopback hostnames unless explicitly overridden; it is not a public API. Worldwide development basemap, optional terrain, and attribution configuration are documented in [`apps/web/.env.example`](../../apps/web/.env.example) and [map data providers](map-data-providers.md). Copy only intended public values into an ignored `.env.local`; set `NEXT_PUBLIC_BASEMAP_STYLE_URL=off` for graph-only startup. The actual graph renders without external tiles.

Web verification commands are `npm run typecheck:web`, `npm run test:web`, `npm run build:web`, and `npm run test:web:e2e`. Browser tests use a locally installed compatible Chrome when `PLAYWRIGHT_CHROME_PATH` is set; CI does not silently download a browser. With a production server running, `npm run benchmark:web:api`, `npm run benchmark:web:browser`, and `npm run visual:web` produce bounded measurement and ignored screenshot evidence. The browser path must be explicit.

Next.js 16.4.5 generates `apps/web/next-env.d.ts` during `next typegen`, `next dev`, and `next build`. Development and production generation intentionally reference different `.next` type directories, so the file is ignored rather than committed. The web typecheck already runs `next typegen` before `tsc`; do not hand-edit or stage the generated declaration.

No global package install, cloud account, secret, map download, or external service is needed. Future setup scripts must be idempotent, explain network and disk use, and avoid changing global machine configuration.

## Future local topology

The intended developer loop will run the web/API emulators and a bounded local simulation container with synthetic tiny fixtures. Cloud dependencies need local substitutes or opt-in integration profiles. Defaults must never contact or mutate production. Example environment variables belong in `.env.example` with non-secret values; real `.env*` files stay ignored.

ARM64 container images must be available or multi-architecture. Numerical reproducibility tests compare supported architecture/runtime pairs and document equivalence rules instead of assuming bitwise identity.

## Data handling

Do not place downloaded OSM extracts, derived graphs, PMTiles, or run outputs in Git. `data/README.md` defines local directories and provenance expectations. Tests use the smallest synthetic or redistributable fixture that proves behavior.
