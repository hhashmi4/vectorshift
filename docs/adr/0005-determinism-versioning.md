# ADR 0005: Determinism and scenario/run versioning

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Architecture and simulation

## Context

Explanations, comparisons, retries, and research use are trustworthy only when semantic inputs are immutable and reproducible.

## Decision drivers

- Replayability, auditability, safe concurrency, cache correctness, and honest comparison.

## Considered alternatives

- Mutable scenarios/results are easy initially but make retries and evidence ambiguous.
- Eventual best-effort reproducibility tolerates runtime drift but weakens the product's central claim.
- Versioned snapshots and canonical manifests add discipline and enable verification.

## Decision

Published map/graph/model versions and run manifests are immutable. Scenario changes form optimistic-concurrency revisions with unique command IDs. Every stochastic choice comes from a specified generator/seed/stream policy. Canonical serialization, numerical equivalence, runtime/build identity, and output checksum policy are versioned. Retries create attempts of one semantic run, not new inputs.

## Consequences

Storage and migration overhead increase, but results are attributable and caches safe. Runtime upgrades may require a new model/build compatibility identifier.

## Risks

Floating-point/runtime differences, hidden nondeterminism, and accidental mutable object keys can break guarantees. Cross-environment replay, deterministic scheduling, and conditional object creation are mandatory.

## Revisit triggers

The guarantee may be narrowed only through a new ADR with measured evidence and explicit user-visible semantics; it cannot be relaxed as an optimization detail.
