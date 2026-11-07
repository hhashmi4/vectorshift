# Graph package boundary

This package contains the canonical directed, turn-aware graph model, deterministic importers, bounded OSM restriction compiler, validation, integrity-checked serialization, graph analysis, routing index, Dijkstra reference, A*, fixtures, benchmarks, and tests. Version-scoped identities, provenance, units, supported restriction semantics, and serialization are part of the contract.

It never performs network acquisition and does not embed UI, cloud, persistence, or simulation concerns. Acquisition belongs to `tools/data-pipeline`.

## Commands

```sh
npm run test --workspace @vectorshift/graph
npm run benchmark --workspace @vectorshift/graph
npm run benchmark:routing --workspace @vectorshift/graph
```

Node 24 executes erasable TypeScript directly at runtime. The root pins TypeScript and Node type declarations locally; `npm run typecheck` is part of `npm run check` and CI.

The [graph contract](../../docs/architecture/road-graph.md) and [routing contract](../../docs/architecture/routing.md) document the implemented subset and explicit limitations.
