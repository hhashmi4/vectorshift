---
name: simulation-correctness
description: Review VECTORSHIFT routing, demand, mesoscopic model, numerical-policy, or result changes for deterministic correctness and reproducibility. Use for simulation semantics, model inputs, algorithm changes, optimizations, and output schemas; not for UI-only work.
---

# Simulation Correctness Review

Protect reproducible model behavior before considering speed.

## Inputs

Obtain the model/change description, equations or state transitions, units, manifest/schema versions, graph/demand fixture, seed/RNG policy, timestep/iteration order, numerical policy, resource bounds, expected invariants, reference outputs, and supported runtimes/architectures.

## Workflow

1. Define semantic inputs and prove each is frozen in the run manifest; separate operational attempt metadata.
2. Trace sources of nondeterminism: RNG stream assignment, unordered iteration, parallel reduction, floating point, time, environment, retry, and serialization.
3. State domain invariants and edge cases: non-negativity, conservation with declared sources/sinks, capacity/queue bounds, valid graph/turn references, unreachable demand, cancellation, and partial output.
4. Design layered tests: hand-auditable examples, properties/metamorphic relations, golden canonical fixtures, retry/replay, supported-environment comparison, and fault/resource-limit paths.
5. For an optimization, compare against the accepted reference under the documented equivalence policy before interpreting benchmark results.

## Checks

- Identical semantic inputs produce equivalent canonical output and checksum under declared scope.
- Seed alone is not treated as sufficient when generator/version/stream policy differs.
- No wall clock, process scheduling, worker ID, or stale mutable asset affects results.
- Cancellation/failure cannot publish a successful final manifest.
- Model limitations and synthetic-data language accompany externally visible outputs.

## Output

Report semantic change, reproducibility scope, invariants, counterexamples/findings, required fixtures/tests, manifest/schema impact, performance evidence if relevant, limitations, and verdict `correctness supported`, `supported with conditions`, or `not supported`. Never fabricate expected values or benchmarks.
