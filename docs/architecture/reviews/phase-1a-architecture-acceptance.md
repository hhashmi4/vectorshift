# Phase 1A architecture acceptance review

- **Review date:** 2026-11-06
- **Scope:** directed road graph contract, OSM acquisition boundary, normalized/OSM import, validation, serialization, integrity, statistics, and Phase 1B handoff
- **Verdict:** Ready with conditions

## Authority and consistency reviewed

The root instructions, README, provisional source specification, system design, distributed-systems invariants, open-decision register, product requirements, roadmap, ADR index, ADR 0003, graph/data component boundaries, and applicable review skills were read before modification. No original engineering RFC PDF exists in `docs/reference`, so no reconciliation was possible and the provisional source specification remains authoritative.

Phase 0 was internally consistent. Its README/status was expected to become stale when implementation began, and ADR 0003 was intentionally Proposed pending Phase 1 evidence. No conflict was found among accepted decisions, graph ownership, immutable publication, licensing, or performance policy.

## Decision and boundary findings

- `packages/graph` owns the source-independent domain model, deterministic importer, OSM format adapter, validation, canonical serialization, integrity verification, and graph statistics. It has no browser, Cloudflare, object-storage, database, or simulation dependency.
- `tools/data-pipeline` owns network acquisition and publication workflow. Ordinary tests never access the network. Raw/derived data stays ignored; the committed manifest carries immutable provenance and hashes.
- `packages/contracts` owns the language-neutral JSON Schema. Code and schema use explicit E7 coordinates, millimetres, milliseconds, versioned datasets, and strict unknown-field handling.
- The stored graph is a compact directed primal graph with sparse edge-to-edge turn rules. Phase 1B routing will use incoming-edge state. This retains turn-aware semantics without materializing every legal transition on disk.
- Topology follows explicit IDs only. Rendering geometry can be simplified or cross another line without creating connectivity.
- Bidirectional segments become two directed edges. Parallel edges are valid; duplicate IDs, missing endpoints, self-loops, zero geometry, invalid properties, and illegal turn joins are rejected.
- Canonical ordering uses locale-independent Unicode code-unit comparison. Artifact SHA-256 detects corruption and binds exact graph bytes.

## Evidence

- Fourteen unit/property-style tests cover the ten requested verification categories plus turn joins and basic OSM translation.
- The pinned 1,811,425-byte Toronto Overpass input imported to 7,969 nodes and 18,359 directed edges, producing the same graph digest across benchmark repetitions.
- The real import identified 19 weak components and 133 unimplemented restriction relations, demonstrating that connectivity and restriction gaps are visible rather than hidden.
- Benchmark environment, workload, method, distribution, memory caveats, implementation digest, and raw result are recorded under `tools/benchmarks/results`.

## Alternatives and trade-offs

- Node-only routing was rejected because approach-dependent turn legality/cost would require hidden path state.
- A fully edge-expanded serialized graph was deferred because it multiplies storage and publication complexity; a routing-time edge-state view preserves semantics.
- Floating geographic coordinates were rejected in the canonical schema in favor of E7 integers. The OSM adapter still uses a versioned Node 24 Haversine calculation before quantizing length to millimetres; cross-runtime length reproduction remains a pipeline-version concern.
- A large regional extract was rejected for Phase 1A. A small historical Overpass query is bounded and auditable, while its exact bytes—not server availability—anchor reproduction.

## Conditions and remaining risks

The graph representation is accepted, but the dataset is not yet a production routing dataset. Phase 1B must:

1. parse and test OSM node- and via-way restriction relations, mode exceptions, and U-turn policy;
2. define legal mode/access behavior, including conditional and direction-specific tags or explicitly exclude them;
3. investigate the 19 weak components and artificial bounding-box edges;
4. define strong/reachability statistics and routing cost semantics;
5. compare reference routes against hand-audited source evidence;
6. add static TypeScript type checking when the repository toolchain dependency is approved;
7. validate canonical graph reproduction on a second supported machine/runtime before public publication.

No database, queue, cloud resource, deployment, paid service, or infrastructure change is authorized by this review.
