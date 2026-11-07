# Phase 1B routing correctness review

- **Review date:** 2026-11-06
- **Scope:** schema-v2 graph compatibility, OSM relation/access audit, deterministic graph analysis, Dijkstra, A*, independent verification, TypeScript gate, and Toronto benchmark
- **Verdict:** Accepted for the documented bounded semantics; not accepted as complete real-world legal routing

## Architecture review findings

Phase 0 and Phase 1A authority, boundaries, ADR 0003, graph contracts, acquisition manifests, tests, roadmap, and applicable skills were reviewed before implementation. The original RFC PDF is still absent from `docs/reference`; the provisional source specification remains authoritative. The repository still has no commits, so earlier self-reported test and benchmark success was not treated as independent proof.

The implementation remains inside `packages/graph` and `tools/data-pipeline`; it has no browser, Cloudflare, database, simulation, or infrastructure dependency. Schema version 2 was necessary rather than silently mutating version 1: turn rules now declare modes and edge traversal costs may be zero. Prior schema and pipeline artifacts remain immutable.

## Invariants and ownership

- Topology comes only from node/edge IDs. Geographic geometry never creates connectivity.
- Routing uses incoming directed edge as state and applies the same access, forbidden-turn, and penalty lookup in Dijkstra and A*.
- Costs are non-negative safe integer milliseconds; penalties are positive; no route mutates graph state.
- Stable edge ordering, strict-improvement relaxation, and queue tie-breaking make a fixed query deterministic.
- A* uses an admissible/consistent bound derived from topological endpoint displacement and eligible edge cost. Positive-distance zero-cost edges force the zero heuristic.
- OSM relations have one mutually exclusive audit disposition. Unsupported or unresolved semantics produce no turn rule and remain visible.
- Raw OSM and generated graph artifacts stay ignored. The manifest binds source bytes, transform/schema version, derived digest, license, and audit.

## OSM audit and access findings

All 133 returned relations are restriction relations. Pipeline 2 imports 56 unconditional generic via-node relations into 67 mode-scoped forbidden transitions. It rejects 39 conditional, 2 mode-specific, 23 `except=*`, 2 via-way, and 11 unresolved way/direction/access relations. Supported generic rules include `no_left_turn`, `no_right_turn`, `no_straight_on`, `no_u_turn`, and `only_*`; the compiler supports values only where member shape/direction and modes resolve.

Generic restrictions apply to motor vehicles and bicycles, not pedestrians. Generic vehicle one-way direction is separated from pedestrian direction, and explicit bicycle/foot/motor overrides are recognized. A conservative denied access set removes modes. These choices follow the documented OSM model but are not a complete legal-access engine.

## Graph findings

Pipeline 1's 19 weak components were not assumed erroneous. Pipeline 2 has 16 all-mode weak components with sizes `7717, 57, 20, 19, 10, 8, 6, 5, 4, 3, 3, 3, 2, 2, 2, 2` and 111 strong components; the largest strong component has 7,622 nodes. The motor-filtered view has 3,877 eligible edges and a largest 1,830-node strong component. It also reports 5,574 isolated published nodes because non-motor nodes remain in the immutable multi-mode graph; this is expected under mode filtering, not evidence of 5,574 malformed road nodes.

The Overpass intersection query retrieves full member ways, so 594 retained nodes lie outside the filter rectangle. Thirty-six nodes are within the configured E7 boundary tolerance. These figures make truncation visible; they do not prove that all boundary effects are detected.

## Verification evidence

The standard gate runs documentation validation, strict TypeScript, and 22 tests. The hand-audited corpus independently specifies expected paths/costs for restrictions, penalties, modes, one-way/unreachable cases, components, parallel and zero-cost edges, equal-cost alternatives, and start-equals-destination. A separate path checker recalculates legality and cost.

Eighty deterministic random graphs compare each algorithm with a simple independent Bellman–Ford edge-state oracle. A metamorphic test verifies cost monotonicity when an edge cost increases. The Toronto benchmark checks 500 fixed-seed queries; Dijkstra and A* agreed on status and optimal cost for all 500. Actual latency, search-work, and memory results are in the [benchmark summary](../../../tools/benchmarks/results/phase1b-toronto-routing.md).

## Residual risks and conditions

- Conditional, via-way, `except=*`, and mode-specific restrictions are unimplemented; 11 Toronto relations remain unresolved after filtering.
- Default U-turn behavior is permissive unless explicitly forbidden. Jurisdictional, lane, dimension, live, and time-dependent access are absent.
- The conservative access mapping can still admit or exclude routes incorrectly. Pinned OSM data can be incomplete or stale.
- The Toronto extract is bounded and path-oriented; it is not a city-scale or production-demand benchmark.
- A second machine/runtime has not reproduced the graph artifact or routing results.
- The index copies immutable routing fields and computes a graph hash at construction; larger graphs may require memory/layout work only after profiling.

The recommended next task is Phase 1C: close or product-exclude restriction/access gaps, perform hand-inspected OSM route review and boundary/halo experiments, and reproduce artifacts on a second environment before simulation consumes this graph as trusted reference data.
