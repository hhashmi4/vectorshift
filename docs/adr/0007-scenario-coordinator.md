# ADR 0007: Durable Objects as scenario coordinators

- **Status:** Proposed
- **Date:** 2026-11-06
- **Owners:** Distributed systems

## Context

Each scenario needs one authoritative command order, revision/idempotency state, run transitions, and an ordered resumable stream.

## Decision drivers

- Per-key serialization, durable state, WebSocket integration, geographic latency, recovery semantics, and low operational load.

## Considered alternatives

- Postgres transactions/advisory locks centralize state but require database operations and stream fan-out.
- Redis/lock services add split-brain and durable-history concerns.
- Actor systems fit the model but add a platform.
- Durable Objects provide a managed per-scenario actor near the intended edge stack.

## Decision

Prototype one Durable Object per scenario as the single authoritative writer. Persist compact state and snapshot references, use explicit epochs/fencing, and keep immutable large payloads in R2. Do not treat in-memory state or a WebSocket connection as durable truth.

## Consequences

Command ordering and stream ownership align. Limits, migration, jurisdiction, local testing, cost, and vendor coupling require explicit engineering.

## Risks

Actor overload, storage/hibernation semantics, unavailable replay history, or migration mistakes could threaten correctness. Bounded state, snapshots, fault tests, and a portable state-machine core mitigate them.

## Revisit triggers

Accept/revise after testing concurrent commands, restarts, alarms, WebSocket hibernation, state migration, regional behavior, and expected per-scenario load/cost.
