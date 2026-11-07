# VECTORSHIFT

VECTORSHIFT is an open-source, map-first platform for deterministic urban disruption experiments. It is intended to let people alter a versioned synthetic road-network scenario—closing roads, changing capacities, introducing hypothetical floods, or changing seeded demand—and inspect how the effects propagate.

The defining product concept is **Butterfly Effect Mode**: each result should connect an intervention to changed routes, bottlenecks, connectivity, accessibility, and an evidence trail. VECTORSHIFT will model synthetic scenarios; it must never present its output as observed traffic or a real-world traffic forecast.

## Current status

This repository has completed **Phase 1D: reference graph hardening and Visual Experience V1** for local engineering use and now includes a worldwide mapping foundation. It contains the directed-graph foundation, deterministic Dijkstra/A*, independent correctness tests, a source-traceable OSM restriction audit, bounded halo comparison, boundary qualification, and a local Next.js/MapLibre workspace. The map can explore worldwide basemap context while routing remains limited to the explicitly labeled experimental downtown Toronto graph. The halo publication candidate remains blocked. The repository does not contain a public routing API, simulation engine, traffic predictions, worldwide graph, or production-ready legal/navigation service.

The original `VECTORSHIFT — Staff Engineering Blueprint, RFC 001, November 6, 2026` PDF is not currently present. [The provisional source-spec summary](docs/architecture/source-spec.md) records the supplied decisions until the PDF is imported and reconciled.

## Start here

- [Product requirements](docs/product/requirements.md)
- [System design](docs/architecture/system-design.md)
- [Road graph contract](docs/architecture/road-graph.md)
- [Routing correctness contract](docs/architecture/routing.md)
- [Local routing map architecture](docs/architecture/routing-map.md)
- [OSM acquisition and licensing](docs/engineering/osm-data-acquisition.md)
- [Map context, terrain, and provider licensing](docs/engineering/map-data-providers.md)
- [Concurrency and recovery invariants](docs/architecture/distributed-systems.md)
- [API contracts](docs/architecture/api-contracts.md)
- [Open architecture decisions](docs/architecture/open-questions.md)
- [Security threat model](docs/engineering/security.md)
- [Product roadmap](docs/roadmap/product-roadmap.md)
- [Architecture decisions](docs/adr/README.md)
- [Contributor guide](CONTRIBUTING.md)

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js/React/MapLibre public client boundary |
| `services/api` | Future Cloudflare Worker public control-plane API |
| `services/simulation` | Python simulation and internal compute boundary |
| `packages` | Versioned contracts, graph, mapping, and design-system libraries |
| `tools` | Data pipeline, benchmarks, and repository validation |
| `tests` | Cross-component integration, end-to-end, and small licensed fixtures |
| `infra` | Declarative Cloudflare and container deployment candidates |
| `docs` | Product and engineering source material |
| `.agents/skills` | Deliberately invoked engineering review playbooks |

See [AGENTS.md](AGENTS.md) for boundaries and change rules. Directories that do not yet contain production code carry a README defining their intended contract; they are not claims of implementation.

## Local validation

Node.js 24 is the repository baseline. Install the exact locally pinned development dependencies, then run the standard gate:

```sh
npm ci
npm run check
```

To run the local routing map after placing the pinned ignored OSM response at the manifest path:

```sh
node tools/data-pipeline/scripts/import-osm.ts
npm run dev:web
```

Python dependencies have not been selected. Python 3.14 compatibility is not assumed; simulation dependency evaluation will test 3.13 first and 3.14 separately. See [local development](docs/engineering/local-development.md).

## License and safety

Code and documentation are licensed under Apache-2.0; imported map data retains its source licensing and attribution requirements. Report vulnerabilities using [SECURITY.md](SECURITY.md), not a public issue.
