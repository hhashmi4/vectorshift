# ADR 0004: Mesoscopic rather than microscopic simulation

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Simulation

## Context

The product needs city-scale interactive disruption effects and explanations, not vehicle-control fidelity. Public compute must remain bounded.

## Decision drivers

- Determinism, city-scale throughput, explainable flows/queues, resource cost, and implementation verifiability.

## Considered alternatives

- Microscopic simulation offers vehicle-level behavior but adds calibration, compute, and stochastic complexity unsupported by the product claim.
- Macroscopic flow models scale well but may obscure route/queue detail needed for explanations.
- Mesoscopic fixed-step flow/agent aggregation balances network effects and cost.

## Decision

Build a deterministic mesoscopic engine with fixed timesteps, seeded synthetic demand, explicit queue/capacity semantics, and documented limitations. Do not imply signal-, lane-, or driver-level fidelity unless a future model explicitly adds and validates it.

## Consequences

The engine can prioritize reproducibility and network propagation. Results require careful language and cannot answer microscopic safety/control questions.

## Risks

Users may overinterpret output, and coarse modeling may distort localized congestion. Persistent disclosure, calibration boundaries, and fixture-based invariants mitigate this.

## Revisit triggers

Revisit if validated user needs require microscopic behavior and capacity/cost evidence supports a separate model rather than silently changing the existing one.
