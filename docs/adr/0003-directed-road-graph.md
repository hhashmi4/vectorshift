# ADR 0003: Directed, turn-aware road graph representation

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Graph and routing

## Context

Urban routing must represent direction, restrictions, capacities, costs, and scenario changes reproducibly. Exact schema and turn encoding require fixture-driven evaluation.

## Decision drivers

- Correct one-way/turn semantics, stable version-scoped identity, compact traversal, provenance, and deterministic serialization.

## Considered alternatives

- Node-edge graph with turn checks is simple but can make turn-dependent traversal awkward.
- Edge-based expanded graph simplifies routing transitions but increases size.
- Hybrid adjacency with turn tables may balance size and clarity.

## Decision

Represent roads as a directed primal graph with version-scoped node/edge IDs, explicit source/target nodes, separate rendering geometry, length, permitted modes, per-mode traversal costs, hierarchy, and provenance. Bidirectional source segments become two edges; parallel edges remain distinct.

Store prohibited and penalized edge-to-edge turns in a sparse turn table. Routing uses incoming directed edge as state and constructs its edge-state transitions in memory rather than publishing a fully edge-expanded graph. Canonical E7/integer units, strict validation, locale-independent serialization, SHA-256 integrity, and immutable dataset/schema versions are required. The current detailed version 2 contract is [road-graph.md](../architecture/road-graph.md); version 1 remains immutable historical evidence.

Schema version 2 scopes every turn rule to explicit modes and permits non-negative edge traversal time while retaining positive length and positive penalties. Dijkstra is the reference algorithm. A* must use identical edge-state legality and an admissible/consistent heuristic, falling back to zero when no sound bound exists.

## Consequences

Routing and simulation share explicit semantics, but graph publication and scenario references become schema-sensitive. Cross-version ID translation is not assumed. Edge-state routing has more states than node-only routing, while sparse on-disk turns avoid fully expanded publication size.

## Risks

OSM restriction/access complexity, topology errors, routing-time edge-state growth, and unstable extraction can invalidate results. Phase 1B implements only the documented bounded via-node subset. Tiny pathological fixtures, source/graph hashes, deterministic rebuild checks, explicit audit dispositions, independent-oracle tests, and hand-audited Phase 1B routes mitigate these risks.

## Revisit triggers

Revisit if edge-state routing exceeds accepted memory/latency budgets, sparse turn lookup is a measured bottleneck, a source requires lane/conditional state that the model cannot express, cross-version ID mapping becomes a product requirement, or a second implementation cannot reproduce canonical artifacts.

## Acceptance evidence

Phase 1A imported the pinned Toronto reference bytes into 7,969 nodes and 18,359 edges, exercised 14 automated tests including deterministic serialization and turn joins, and reproduced one graph SHA-256 across 10 benchmark runs. The [architecture acceptance review](../architecture/reviews/phase-1a-architecture-acceptance.md) records conditions deferred to Phase 1B.

Phase 1B's pipeline 2 graph has 7,863 nodes, 19,997 edges, and 67 compiled rules from 56 of 133 restriction relations. Twenty-two automated tests include an independently specified corpus, 80 seeded graphs checked against a Bellman–Ford state oracle, and a monotonic-cost metamorphic check. Dijkstra and A* agreed on status and optimal cost for all 500 benchmark queries. See the [routing contract](../architecture/routing.md) and [Phase 1B review](../architecture/reviews/phase-1b-routing-review.md).

Phase 1C pipeline 3 preserves schema version 2 and adds a versioned, graph-bound support sidecar rather than pretending unresolved temporal/via-way semantics fit the graph. It compiles 82 rules from 56 full and 12 partial relations; 77 concerns remain source-traceable and cause affected candidate paths to be withheld. A clean temporary install on the same machine reproduced graph SHA-256 `c12c4523e0b43725d6ad843816593395b6a0e780408c8009dc928756105c6573` and support SHA-256 `a4b8c49ec359cad6b70e947b012e6e01f8d0b984b2d066f734c61666fe362eae`. This is not second-machine evidence.
