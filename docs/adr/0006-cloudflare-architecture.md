# ADR 0006: Cloudflare public control plane with independent compute

- **Status:** Proposed
- **Date:** 2026-11-06
- **Owners:** Platform

## Context

The public product needs globally available static/map delivery, low-latency coordination, WebSockets, immutable object storage, and CPU-heavy jobs that do not fit an edge runtime.

## Decision drivers

- Operational simplicity, public latency, DDoS/abuse controls, coordinator primitives, cost visibility, and compute portability.

## Considered alternatives

- One conventional cloud stack offers broad services but adds initial network/operations surface.
- Kubernetes is flexible but unjustified for the initial team and workloads.
- Cloudflare for delivery/control with independent containers separates edge and CPU concerns.

## Decision

Target Cloudflare Workers, Durable Objects, and R2 for public delivery, API/coordination, and immutable storage. Deploy simulation containers independently behind an authenticated internal interface. Keep contracts provider-neutral enough to test locally and replace components. Phase 0 provisions nothing.

## Consequences

The architecture uses managed edge primitives and a clear compute boundary, but spans providers/runtimes and requires trace, identity, egress, outage, and local-emulation design.

## Risks

Provider limits, pricing, lock-in, cross-plane latency, and regional outages remain unmeasured. Prototype critical limits and model cost before acceptance.

## Revisit triggers

Accept/revise after a bounded vertical slice validates Durable Object limits, R2 range/object behavior, compute connectivity, failure recovery, and cost ceilings.
