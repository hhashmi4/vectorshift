# Open architecture and launch decisions

This register consolidates unresolved choices; Proposed ADRs remain the detailed decision records. An owner and evidence plan are assigned when the relevant phase begins, not an arbitrary completion date.

| Decision | Current direction | Evidence required | Decision gate |
| --- | --- | --- | --- |
| Original RFC reconciliation | Provisional source spec governs | Import RFC PDF; diff decisions and update/supersede affected ADRs | Before accepting architecture beyond Phase 0 |
| Canonical serialization/numerical equivalence | Version both; prefer deterministic integer/fixed-point semantics where practical | Cross-runtime prototypes and replay fixtures | Before graph/run manifest schemas stabilize |
| Simulation runtime | Validate Python 3.13 first; 3.14 separately | Complete direct/transitive dependency wheel/build/test matrix on ARM64 and Linux | Phase 3 entry |
| Mesoscopic model details | Fixed-step, seeded, explicit queues/capacities | Model specification, invariants, limitation language, hand-auditable fixtures | Phase 3 implementation |
| Cloudflare topology | Workers, Durable Objects, R2 candidates | Limits, local testability, range behavior, failure recovery, jurisdiction, cost | ADRs 0006/0007 acceptance |
| Dispatch durability | Bounded direct dispatch with reconciliation first | Outage/burst/load evidence and delivery objectives | ADR 0008 acceptance or queue adoption |
| Anonymous access model | Scoped expiring capability/session | Privacy, revocation, sharing, retention, abuse, cache, and UX review | Phase 4 contract; Phase 8 release gate |
| Metadata discovery/persistence | No Postgres/PostGIS initially | Concrete cross-scenario query/collaboration requirements and scale | ADR 0009 revisit trigger |
| Reference workloads and targets | Performance values are hypotheses | Approved graphs/demand/devices/hardware, benchmark distributions, cost model | First baseline in Phases 2–3 |
| Rust hot paths | Python reference first | Profiled stable bottleneck and FFI/replay/packaging proof | ADR 0010 acceptance or replacement |
| Retention and recovery objectives | Define after provider and product evidence | Data classes, legal/privacy needs, restore exercises, provider capabilities, cost | Before public beta |
| Project contacts and governance | Maintainer mechanisms are placeholders | Named monitored security/conduct channels and response ownership | Before accepting public reports/contributions |

Closing an item requires an accepted ADR or an update to the authoritative document named in its gate, plus tests/operations documentation where applicable.

## Resolved in Phase 1A

- The reference acquisition is the pinned downtown Toronto Overpass query and content-addressed manifest described in [OSM acquisition](../engineering/osm-data-acquisition.md).
- [ADR 0003](../adr/0003-directed-road-graph.md) accepts a directed primal graph with sparse turn rules and routing-time incoming-edge state. Full OSM restriction/access correctness remains a Phase 1B condition rather than an unresolved storage-layout decision.

## Resolved in Phase 1B

- Dijkstra is the correctness reference; A* uses identical edge-state legality and a conservative endpoint-distance heuristic with mandatory zero fallback.
- Graph schema version 2 adds mode-scoped turns and non-negative traversal costs. Published version 1 artifacts remain immutable.
- The pinned Toronto relation audit and bounded unconditional generic via-node subset are recorded in [OSM acquisition](../engineering/osm-data-acquisition.md). Unsupported cases are rejected rather than silently treated as legal.
- Strict TypeScript verification is locally pinned and part of the standard check and CI.

## Phase 1C routing decisions and remaining publication gates

| Decision | Current direction | Evidence required | Decision gate |
| --- | --- | --- | --- |
| Conditional restrictions | Reject affected paths without a documented evaluation context | Temporal parser, time zone/date/vehicle context, fixtures | Before time-qualified routing |
| Via-way restrictions | Reject affected source-way sequences | Formal sequence automaton and hand-audited paths | Before real-world route publication |
| `except=*` and per-mode precedence | Compile only unambiguous supported modes; retain aggregate motor ambiguity | Finer vehicle taxonomy or explicit product exclusion | Before transit-aware routing |
| Default U-turn policy | `source_rules_only`, explicitly disclosed | Jurisdiction/product policy and dead-end fixtures | Before navigation claims |
| Access completeness | Conservative bounded tag subset | Current OSM access review, Toronto false-positive/negative audit | Before public routing claims |
| Boundary endpoint policy | Select eligible SCC nodes beyond a 100 m buffer and qualify returned paths | Acquire/compare prepared 500 m halo and inspect changed routes | Reference publication gate |
| Routing optimization | Preserve reference algorithms first | Larger city workload, profiles, memory/latency distributions | Before contraction/customization work |

The graph hash reproduced in a clean temporary install on the same Apple M4 machine. That verifies dependency isolation and canonical bytes, not cross-machine behavior. A second supported machine/runtime remains required before claiming cross-environment reproduction.

## Phase 1D evidence and remaining decisions

The 500 m partitioned halo was acquired reproducibly and compared. It improves the measured core sample but does not close publication: eight routes changed, 147 restriction/access concerns remain, full via-way alternative routing and conditional evaluation are absent, and no second machine reproduced the artifacts. The blocked candidate is recorded in the [publication manifest](../../data/manifests/reference-graph-publication-candidate-v1.json).

OpenFreeMap Liberty is the default local-development basemap candidate, not a production SLA. Before public hosting, select a tile strategy with explicit availability, rate/egress, privacy, attribution, versioning, cache, and cost terms; ADR 0002's PMTiles direction remains authoritative. The graph-only fallback is a required product capability, not a substitute for that decision.

The Mapzen/AWS Terrain Tiles example is accepted only as an opt-in development DEM. Public terrain delivery remains open pending composite-source license review, immutable source/version metadata, caching and egress design, privacy, availability, and cost evidence. No DEM may become routing or simulation input without a separate versioned data contract and validation pipeline.
