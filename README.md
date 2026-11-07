# VECTORSHIFT

VECTORSHIFT is an open-source, map-first platform for explainable, deterministic urban-disruption experiments. The long-term product will let people change a versioned synthetic road-network scenario—closing roads, reducing capacity, introducing a hypothetical flood, or changing seeded demand—and inspect how those interventions propagate.

The differentiator is **Butterfly Effect Mode**: results should connect an intervention to changed routes, bottlenecks, connectivity, accessibility, and reproducible evidence. This capability is planned, not yet implemented. VECTORSHIFT will model synthetic scenarios and must never present its output as observed traffic, navigation advice, or a real-world traffic forecast.

## Project status

Development has reached **Phase 1D: reference graph hardening and Visual Experience V1** for local engineering use.

Implemented today:

- a typed, directed, edge-based road graph with deterministic serialization, validation, connectivity analysis, stable identifiers, travel modes, turn rules, and source provenance;
- deterministic Dijkstra and A* routing with legal-transition checks, conservative unsupported-restriction diagnostics, independent correctness fixtures, and reproducible benchmarks;
- bounded OpenStreetMap acquisition and import tools with content hashes, ODbL attribution, immutable manifests, and explicit publication qualification;
- a local Next.js and MapLibre workspace that renders actual graph and route geometry, supports worldwide basemap exploration, optional rights-reviewed terrain, provider-supplied 3D buildings, and a graph-only fallback; and
- strict TypeScript, unit, randomized, metamorphic, browser, accessibility, documentation, build, and benchmark verification.

The worldwide map is geographic context only. Routing is limited to an **experimental bounded downtown Toronto graph**, whose publication candidate remains blocked by documented restriction, boundary, route-review, and cross-machine reproduction gaps.

Not implemented:

- the traffic simulation engine, seeded travel demand, Butterfly Effect explanations, scenario comparison, or flood propagation;
- worldwide routing graphs or navigation-grade routing;
- the public Cloudflare API, Durable Object coordination, WebSocket streaming, anonymous-user quotas, or production deployment; and
- observed traffic ingestion, traffic prediction, or real-time navigation.

The original `VECTORSHIFT — Staff Engineering Blueprint, RFC 001, November 6, 2026` PDF is not present. The [provisional source specification](docs/architecture/source-spec.md) records the supplied decisions until the PDF is imported and reconciled.

## Architecture

The current executable path is deliberately small: the local Next.js server loads an ignored, content-verified graph artifact; the browser receives bounded GeoJSON views and submits local route queries; `packages/graph` remains independent of the web application, cloud infrastructure, and future simulation engine.

| Path | Responsibility |
| --- | --- |
| `apps/web` | Local Next.js/React/MapLibre workspace and read-only routing adapter |
| `packages/graph` | Directed graph model, OSM import, validation, analysis, Dijkstra, and A* |
| `packages/contracts` | Versioned schemas and future cross-boundary contracts |
| `packages/mapping` | Future mapping-asset contracts and PMTiles integration |
| `services/api` | Reserved future Cloudflare Worker control-plane boundary |
| `services/simulation` | Reserved future deterministic simulation-compute boundary |
| `tools/data-pipeline` | Bounded source acquisition, import, comparison, and publication evidence |
| `tools/benchmarks` | Reproducible graph, routing, API, and browser measurements |
| `data/manifests` | Small provenance and publication-qualification records; no raw map data |
| `docs` | Product, architecture, operations, security, licensing, ADRs, and roadmap |

See [AGENTS.md](AGENTS.md) for ownership boundaries and engineering rules. Reserved boundaries contain a README rather than placeholder implementation.

### Technology baseline

- Node.js 24, TypeScript, npm workspaces
- Next.js 16, React 19, MapLibre GL JS, Tailwind CSS
- Node's test runner, Playwright, and axe-core
- OpenStreetMap-derived road data with versioned JSON graph contracts
- Python compute is planned but has no selected dependency set; Python 3.14 compatibility is not assumed

The target architecture includes Cloudflare delivery and coordination, R2 immutable assets, PMTiles, and independently deployed containerized compute. None of that infrastructure is provisioned by this repository today.

## Local development

Prerequisites are Node.js 24.x and npm. Install the exact locked dependencies and run the standard repository gate:

```sh
npm ci
npm run check
npm run build:web
```

Unit and build checks do not download map data. The interactive Toronto routing workspace additionally needs the pinned raw OSM response and generated graph artifacts, which are intentionally ignored by Git. Acquire the bounded historical extract, import it, and start the loopback-only application with:

```sh
node tools/data-pipeline/scripts/acquire-osm.mjs
node tools/data-pipeline/scripts/import-osm.ts
npm run dev:web
```

The acquisition is an explicit network operation with a 25 MiB response cap. It refuses to overwrite an existing extract, and the importer verifies the committed source digest. Open `http://127.0.0.1:3000`; this is a local engineering tool, not a public routing API.

Basemap and optional terrain configuration are documented in [`apps/web/.env.example`](apps/web/.env.example). Set `NEXT_PUBLIC_BASEMAP_STYLE_URL=off` in an ignored `.env.local` for graph-only startup. Never place a secret in a `NEXT_PUBLIC_*` value.

See [local development](docs/engineering/local-development.md) and the [web workspace README](apps/web/README.md) for component commands and constraints.

## Testing and benchmarks

The primary gate runs formatting-policy, documentation-link, strict TypeScript, graph, and web unit checks:

```sh
npm run check
```

Additional verification includes:

```sh
npm run build:web
PLAYWRIGHT_CHROME_PATH="/path/to/Chrome" npm run test:web:e2e
npm run benchmark:graph
npm run benchmark:routing
```

Browser tests use hermetic map and terrain fixtures. The [benchmark index](tools/benchmarks/README.md) links results that record their environment, workload, sample count, distribution, and limitations; they are local reference measurements, not city-scale or production-capacity claims.

## Limitations and safety

- Toronto routes use pinned historical OSM-derived data, deterministic synthetic free-flow costs, and incomplete legal/access semantics. They are not travel guidance.
- Unsupported restriction concerns can withhold a route rather than silently claim legality.
- Basemap roads and 3D visualization never define authoritative routing topology.
- The development basemap and terrain examples are not approved production SLAs or unlimited public-hosting services.
- No production service, user account system, persistent scenario store, or simulation result exists.

The detailed qualification status is in the [Phase 1D review](docs/architecture/reviews/phase-1d-review.md), [reference graph publication record](docs/engineering/reference-graph-publication.md), and [open questions](docs/architecture/open-questions.md).

## Documentation and roadmap

- [Product requirements](docs/product/requirements.md)
- [System design](docs/architecture/system-design.md)
- [Road graph contract](docs/architecture/road-graph.md)
- [Routing correctness contract](docs/architecture/routing.md)
- [Worldwide map and local routing architecture](docs/architecture/routing-map.md)
- [OSM acquisition and licensing](docs/engineering/osm-data-acquisition.md)
- [Map and terrain provider review](docs/engineering/map-data-providers.md)
- [Security threat model](docs/engineering/security.md)
- [Architecture decisions](docs/adr/README.md)
- [Engineering roadmap](docs/roadmap/product-roadmap.md)

## Licensing and attribution

VECTORSHIFT code and original documentation are licensed under [Apache-2.0](LICENSE).

OpenStreetMap-derived inputs and databases retain their ODbL obligations and are not relicensed under Apache-2.0. Raw OSM responses and derived graph artifacts are excluded from Git; committed manifests retain source, bounds, timestamps, hashes, license, attribution, and transformation versions. Maps and route views display `© OpenStreetMap contributors` separately from basemap and terrain-provider attribution. See [OSM acquisition and licensing](docs/engineering/osm-data-acquisition.md) and [map data providers](docs/engineering/map-data-providers.md).

No third-party map tiles, terrain tiles, fonts, screenshots, or vendor assets are committed to this repository.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), the relevant ADRs, and the nearest component instructions before making changes. Architectural, persisted-format, licensing, deployment, or determinism changes require corresponding documentation and review evidence.

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not open a public issue for a suspected vulnerability. Community participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
