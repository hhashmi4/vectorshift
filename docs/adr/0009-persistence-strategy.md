# ADR 0009: Object/coordinator storage before Postgres/PostGIS

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Architecture and data

## Context

Initial access patterns are per-scenario commands/state and immutable map, snapshot, manifest, and result reads. Persistent cross-scenario spatial queries and rich collaboration are not initial requirements.

## Decision drivers

- Match storage to access patterns, minimize operations, preserve immutability, and avoid premature schema/platform commitments.

## Considered alternatives

- Postgres/PostGIS from inception supports relational/spatial queries but adds migrations, pooling, backups, and a central dependency.
- Object storage alone is poor for serialized mutable coordination.
- Coordinator state plus object storage maps to current mutable/immutable boundaries.

## Decision

Use Durable Object storage for compact authoritative scenario coordination and R2 for immutable releases, snapshots, manifests, and results. Defer Postgres/PostGIS until persistent spatial querying, discovery, analytics, or multi-user collaboration has concrete requirements. Maintain exportable, versioned formats.

## Consequences

Initial topology remains focused and immutable assets scale naturally. Cross-scenario queries, retention sweeps, and metadata search may be limited or implemented through bounded indexes.

## Risks

Late relational adoption can require migration, while abusing object/coordinator storage can recreate a database poorly. Track query needs and state size explicitly.

## Revisit triggers

Introduce an ADR when required queries scan unbounded objects/actors, collaboration needs transactional multi-entity updates, compliance requires relational controls, or operational indexing exceeds platform limits.
