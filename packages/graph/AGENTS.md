# Graph-specific instructions

These rules extend the root [AGENTS.md](../../AGENTS.md).

- Preserve the accepted contract in [ADR 0003](../../docs/adr/0003-directed-road-graph.md) and [road-graph.md](../../docs/architecture/road-graph.md). A semantic/schema change requires versioning and architecture review.
- Connectivity comes only from node/edge IDs. Never infer a junction from coordinate equality or crossing geometry.
- Keep canonical units explicit: EPSG:4326 longitude/latitude E7, millimetres, and milliseconds. Reject unsafe integers and silent unit conversion.
- Directed edges, per-mode costs, sparse turn rules, stable version-scoped IDs, locale-independent ordering, and integrity verification are correctness requirements.
- Keep network acquisition, browser/cloud/persistence concerns, and simulation behavior outside this package.
- Add hand-auditable negative fixtures for topology/turn changes and deterministic/property-style tests for ordering or import changes.
- Run `npm run test:graph` and the root check. Run benchmarks only for a stated performance decision; never update baseline results as a side effect of ordinary tests.
