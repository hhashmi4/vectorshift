# Provisional architectural source specification

**Status:** Provisional<br>
**Recorded:** 2026-11-06<br>
**Superseded by:** the original `VECTORSHIFT — Staff Engineering Blueprint, RFC 001, November 6, 2026` after import and reconciliation

The original RFC PDF was not present when Phase 0 began. This document records the supplied architectural decisions without claiming to reproduce the missing document. Importing the RFC requires a review that identifies differences, updates affected ADRs, and removes the provisional status only after maintainer approval.

## Product constraints

VECTORSHIFT is a public, interactive, explainable urban disruption simulator. It operates on synthetic, seeded demand and versioned maps. It must visibly distinguish simulations from observed traffic and predictions. Anonymous use is expected, so abuse resistance, quotas, and cost controls are core behavior rather than later perimeter work.

## Reference architecture

- **Web:** Next.js, React, TypeScript, MapLibre GL JS, GPU-backed overlays, and deck.gl only when measured complexity justifies it. Tailwind CSS, accessible Radix primitives, and CSS tokens form the design system.
- **Public control plane:** TypeScript Cloudflare Workers. Durable Objects are the target single-writer scenario coordinator. HTTP owns authoritative commands and results; WebSockets provide progress and sampled deltas.
- **Compute plane:** Python FastAPI internal interfaces and containerized deterministic simulation workloads, deployed separately from the edge. Python dependency compatibility must be proven; Python 3.14 is not presumed supported.
- **Graph and routing:** immutable, versioned, directed, turn-aware graphs extracted from properly licensed OpenStreetMap data. Begin with Dijkstra and A* and optimize only from benchmarks.
- **Simulation:** deterministic mesoscopic engine with seeded demand, fixed time steps, immutable run inputs, and explicit limitations.
- **Data:** PMTiles for versioned map delivery; Cloudflare R2 for immutable assets, snapshots, and results. Defer Postgres/PostGIS until persistent spatial queries or collaboration justify it.
- **Dispatch:** do not introduce RabbitMQ by default. Start with bounded synchronous dispatch where safe and evaluate Cloudflare Queues when durable asynchronous delivery is required.
- **Operations:** structured logs, metrics, trace propagation, reproducible run metadata, Cloudflare public delivery/coordination, and independently deployed CPU compute. Avoid unnecessary microservices and Kubernetes.

## Mandatory invariants

1. Identical map, graph, model, seed, parameters, and scenario inputs produce an equivalent canonical result.
2. Published map/graph versions and run manifests never mutate.
3. Scenario writes require an expected revision and unique command ID.
4. One fenced authoritative writer decides command order for a scenario.
5. Submission and retries are idempotent; cancellation/completion races resolve once.
6. Stream sequence numbers increase monotonically per scenario epoch; clients detect gaps and recover from authoritative state.
7. Every workload has explicit input, CPU, memory, output, wall-time, concurrency, and stream budgets with backpressure.
8. Cache keys include every semantic version and tenant/access boundary that can affect output.
9. Public access is hostile by default; experiments and benchmarks are reproducible and never fabricated.

The detailed realization and test strategy live in [system design](system-design.md), [distributed systems](distributed-systems.md), and the [ADR index](../adr/README.md).
