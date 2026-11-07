# ADR 0008: Direct dispatch before managed queues

- **Status:** Proposed
- **Date:** 2026-11-06
- **Owners:** Platform and simulation

## Context

Simulation needs bounded dispatch, retries, cancellation, leasing, and backpressure. Durable background delivery may be needed, but a queue must not become an unexamined source of semantics.

## Decision drivers

- Correctness under at-least-once delivery, operational simplicity, admission/backpressure, cost, and job latency.

## Considered alternatives

- Synchronous execution is simple but cannot survive long jobs or edge lifetime limits.
- RabbitMQ provides control but adds an operated cluster without demonstrated need.
- Cloudflare Queues provide managed durable delivery with platform coupling.
- Bounded direct dispatch plus coordinator leases minimizes Phase 4 surface while preserving a queue-compatible protocol.

## Decision

Design job handling as at-least-once from the start. Prototype bounded direct dispatch from coordinator/dispatcher to compute with durable run state, leases, fencing, and retry. Add Cloudflare Queues when measured duration, burst absorption, outage tolerance, or delivery durability cannot meet accepted behavior. Do not adopt RabbitMQ by default.

## Consequences

Early infrastructure stays small; the dispatch adapter must remain replaceable. Coordinator availability may initially limit enqueue behavior.

## Risks

Direct dispatch can lose wakeups or couple availability. Reconciliation scans, durable queued state, idempotent attempts, and clear admission responses are required.

## Revisit triggers

Queue adoption is triggered by missed dispatch SLOs, required buffering across compute outage, unsafe reconciliation cost, or burst/load evidence. Compare managed queue limits and total cost then.
