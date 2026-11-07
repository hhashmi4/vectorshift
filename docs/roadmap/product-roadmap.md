# Engineering roadmap

This roadmap is sequenced by evidence and dependency, not dates. Scheduling requires team capacity, reference-city scope, and provider constraints.

Graph foundation and routing are now tracked as Phase 1A and Phase 1B. Later phase numbers are retained for continuity with the Phase 0 roadmap and existing references.

## Phase 0 — Repository foundation

**Entry:** product brief and architectural direction available.<br>
**Deliverables:** governance, source-spec summary, system/product/security/operations docs, ADRs, component boundaries, review skills, validation CI.<br>
**Gate:** links and policy checks pass; no secrets/generated assets; claims match repository reality; unresolved decisions are explicit.<br>
**Exit:** senior engineers can locate authority, boundaries, invariants, review process, and next work.

## Phase 1A — Graph acquisition and validation

**Entry:** data license/source and one bounded reference region approved; graph schema ADR accepted.<br>
**Deliverables:** reproducible OSM ingestion, provenance manifest, directed/turn-aware canonical graph, tiny licensed/synthetic fixtures, validation report, immutable publication format.<br>
**Gate:** topology/turn/direction property tests; deterministic rebuild digest; attribution and corruption checks.<br>
**Exit:** one versioned reference graph can be rebuilt and audited without manual edits. Phase 1A establishes this foundation; turn/access completeness and reference-route audit remain Phase 1B entry work.

## Phase 1B — Routing engine

**Entry:** validated graph and canonical cost semantics.<br>
**Deliverables:** Dijkstra reference, A* heuristic, route/evidence schema, correctness corpus, benchmark harness.<br>
**Gate:** A* cost/path equivalence policy against reference; unreachable/turn/restriction tests; measured baseline.<br>
**Exit:** deterministic supported routes with explainable cost components. Phase 1B satisfies this for the explicitly bounded schema-v2 semantics; it does not certify complete real-world legal routing.

## Phase 1C — Reference-data correctness and routing publication gate

**Entry:** reference Dijkstra/A* agreement, restriction audit, and measured bounded-extract baseline.<br>
**Deliverables:** conditional/via-way/exception policy decisions, source-traceable conservative route qualification, explicit U-turn policy, expanded access corpus, boundary diagnostics and halo procedure, clean-environment reproduction, and a local inspectable routing map.<br>
**Gate:** every relation has an implemented or explicitly product-excluded disposition; reviewed routes cover supported semantics; no source incompleteness is converted into invented legality; schema/digest reproduction passes on another supported environment.<br>
**Exit:** the reference dataset is suitable for clearly qualified local routing demonstrations. Phase 1C meets that narrower exit with a same-machine clean reproduction; halo comparison, second-machine reproduction, and real-world publication review remain a Phase 1D gate before navigation-like claims.

## Phase 1D — Reference graph hardening and Visual Experience V1

**Entry:** Phase 1C local map, support sidecar, boundary audit, and clean-environment digest reproduction pass.<br>
**Deliverables:** acquire and compare the bounded halo; implement or product-exclude via-way/conditional concerns; independently inspect affected Toronto routes; reproduce graph/support hashes on a second supported environment; deliver a tested map-first local routing workspace.<br>
**Gate:** no unsupported concern can be silently presented; changed halo routes are explained; cross-environment digests and license publication package pass review; responsive route selection, stale-response protection, basemap fallback, accessibility, and production build pass.<br>
**Exit:** Visual Experience V1 is accepted locally. Graph publication remains blocked by eight unaudited changed routes, 147 source concerns, via-way alternative-search limits, conditional context, aggregate mode ambiguity, residual boundary uncertainty, and absent second-machine evidence. This phase does not turn VECTORSHIFT into navigation software.

## Phase 3 — Deterministic simulation core

**Entry:** routing semantics stable; mesoscopic model inputs/limits defined.<br>
**Deliverables:** fixed-step seeded engine, demand generator, immutable manifest/result schema, replay tests, container boundary.<br>
**Gate:** repeatability across retries and supported environments; conservation/invariant tests; benchmark and numerical-policy evidence.<br>
**Exit:** bounded offline jobs reproduce declared outputs.

## Phase 4 — Scenario coordination

**Entry:** scenario command and run manifests accepted.<br>
**Deliverables:** Worker API, Durable Object state machine, revision/idempotency/fencing, admission limits, object snapshots, compute dispatch adapter.<br>
**Gate:** modeled and injected conflicts, duplicates, terminal races, lease expiry, restart recovery, and quota tests.<br>
**Exit:** authoritative scenario and run lifecycle survives expected failures.

## Phase 5 — Interactive mapping

**Entry:** versioned PMTiles and scenario API available; UI spec reviewed.<br>
**Deliverables:** accessible map-first workspace, edit tools, inspector/change list, honest states, design system.<br>
**Gate:** keyboard/screen-reader/contrast/reduced-motion tests; representative render and memory baseline; conflict UX.<br>
**Exit:** user can create and inspect a scenario without running simulation.

## Phase 6 — Streaming and replay

**Entry:** coordinator event model stable; bounded simulation progress available.<br>
**Deliverables:** WebSocket protocol, sequence/replay/gap recovery, sampled deltas, timeline, backpressure.<br>
**Gate:** drop/duplicate/reorder/slow-consumer/reconnect tests and freshness/resource measurements.<br>
**Exit:** transient connectivity never produces silent stale or out-of-order authoritative state.

## Phase 7 — Comparison and causal explanation

**Entry:** stable result/evidence schemas and compatible baseline/treatment runs.<br>
**Deliverables:** compatibility gate, synchronized comparisons, Butterfly Effect propagation/evidence model, exportable reproducibility manifest.<br>
**Gate:** known-network explanation fixtures, multi-intervention ambiguity handling, usability/accessibility review.<br>
**Exit:** users can trace supported deltas to declared inputs and algorithms without overclaiming causality.

## Phase 8 — Public hosting and security

**Entry:** core journey works in staging; threat controls designed.<br>
**Deliverables:** anonymous scoped access, rate limits/quotas, CORS/CSP, spend breakers, private admin path, retention/privacy and vulnerability response.<br>
**Gate:** abuse/load/IDOR/WebSocket review, IAM/secret rotation, restore exercise, cost envelope.<br>
**Exit:** bounded public beta is safe to operate.

## Phase 9 — Performance optimization

**Entry:** accepted correctness corpus and measured bottlenecks.<br>
**Deliverables:** profiled optimizations, possible Rust hot-path decision, GPU overlay changes only where justified, capacity/cost model.<br>
**Gate:** no correctness/replay regression; statistically defensible performance and cost improvement.<br>
**Exit:** reference workloads meet accepted targets within ceilings.

## Phase 10 — Production hardening

**Entry:** public-beta evidence and failure data.<br>
**Deliverables:** SLOs, on-call runbooks, release/rollback automation, multi-environment compatibility, soak/chaos exercises, support policy.<br>
**Gate:** game days, rollback and disaster recovery, dependency/container/provenance review, operational sign-off.<br>
**Exit:** production launch review accepts residual risk.

## Phase 11 — Open-source launch

**Entry:** stable contributor surfaces, licensing and governance ready.<br>
**Deliverables:** release artifacts, contributor onboarding, roadmap/issues, data attribution, security/community contacts, reproducible demo dataset.<br>
**Gate:** clean-room setup test, documentation audit, legal/security/accessibility review.<br>
**Exit:** external contributors can build, test, understand, and safely extend the project.

## Cross-cutting workstreams

Contracts/versioning precede consumers; correctness precedes optimization; graph and model evidence feed explanation; coordination precedes streaming; observed workloads inform public budgets and SLOs. Security, accessibility, licensing, reproducibility, observability, and cost are gates in every phase rather than terminal phases.
