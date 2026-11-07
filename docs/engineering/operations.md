# Infrastructure and operations design

## Environment model

Use separate local, preview, staging, and production namespaces with distinct credentials, object prefixes/buckets, coordinator namespaces, cache keys, quotas, and telemetry labels. Production data must not flow into preview by default. Phase 0 provisions no resources.

## Deployment candidates

- Cloudflare Pages/Workers (or Workers static assets) for web delivery and the public API.
- Durable Objects for fenced single-writer scenario coordination.
- R2 for immutable PMTiles, graph releases, scenario snapshots, result objects, and manifests.
- Independently deployed, authenticated CPU containers for simulation.
- Cloudflare Queues only when durable background dispatch requirements exceed bounded direct dispatch.

Candidate means unprovisioned and subject to ADR review, cost validation, limits, and failure testing.

## Object storage and caching

R2 keys separate environment and object class and incorporate immutable version/digest. Bucket versioning is defense in depth, not permission to overwrite logical objects. Publication uses conditional create, checksum verification, and manifest promotion. Lifecycle rules must preserve referenced objects and produce audit metrics.

Public versioned tiles use long cache lifetimes and immutable headers. HTML, scenario metadata, and access-scoped results use revalidation/private policies. Cache keys include representation/schema and authorization scope. A release or rollback creates new routing/configuration references; it does not mutate cached immutable content.

## Observability

Emit versioned structured logs, RED metrics for request paths, USE/resource metrics for compute, state-machine counters, queue/lease age, stream lag/gaps, cache hit behavior, quota rejections, object publication failures, and cost allocation tags. Propagate W3C trace context across edge, coordinator, dispatch, compute, and storage metadata while separating untrusted baggage. Sampling retains errors and rare state transitions without recording sensitive payloads.

Initial service objectives are defined only after measured baselines. Alerts must be actionable and tied to a runbook. Dashboards distinguish user-visible health, correctness signals, saturation, and spend.

## Cost ceilings

Before any paid environment, define monthly environment budgets, per-job accounting, concurrency ceilings, storage/egress lifecycle, alert thresholds, and an automated circuit breaker that disables new expensive runs while preserving status/result reads. Cost reports include edge requests, coordinator duration/storage, object operations/storage/egress, compute, telemetry, and safety margin.

## Resilience and disaster recovery

Immutable releases/results reduce backup ambiguity; mutable coordinator state, access grants, and deployment configuration still need backup/export strategy. Recovery objectives remain Proposed until business needs and provider capabilities are measured. Restore exercises must rebuild a scenario from snapshot plus command suffix, verify manifest/object digests, recover stream watermarks, and demonstrate that stale workers cannot commit.

See [disaster recovery](../runbooks/disaster-recovery.md) and [release/rollback](../runbooks/release-rollback.md).
