# Architecture decision records

ADRs capture durable choices and their evidence. `Proposed` records a direction needing validation; `Accepted` is binding; `Superseded` links to its replacement; `Rejected` preserves considered reasoning. Change status through review, not silent edits.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-monorepo-toolchain.md) | Accepted | Monorepo and development toolchain |
| [0002](0002-maplibre-pmtiles.md) | Accepted | MapLibre GL JS and versioned PMTiles |
| [0003](0003-directed-road-graph.md) | Accepted | Directed, turn-aware road graph representation |
| [0004](0004-mesoscopic-simulation.md) | Accepted | Mesoscopic rather than microscopic simulation |
| [0005](0005-determinism-versioning.md) | Accepted | Determinism and scenario/run versioning |
| [0006](0006-cloudflare-architecture.md) | Proposed | Cloudflare control-plane architecture |
| [0007](0007-scenario-coordinator.md) | Proposed | Durable Objects as scenario coordinators |
| [0008](0008-execution-dispatch.md) | Proposed | Direct dispatch before managed queues |
| [0009](0009-persistence-strategy.md) | Accepted | Object/coordinator storage before Postgres/PostGIS |
| [0010](0010-rust-python-hot-paths.md) | Proposed | Python first; Rust only from evidence |

Use [the template](template.md) for new decisions. ADRs must state evidence still needed and link any superseding record.
