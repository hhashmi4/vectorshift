# Simulation-specific instructions

These rules extend the root [AGENTS.md](../../AGENTS.md).

- A run accepts only an immutable, schema-versioned manifest; never fetch mutable `latest` inputs during execution.
- Centralize random-number generator, seed derivation, stream assignment, timestep, iteration order, rounding/numerical policy, and canonical output serialization.
- Keep wall clock, process scheduling, unordered maps/sets, worker identity, and retries out of semantic results.
- Assert model invariants such as non-negative occupancy/flow, bounded capacity, conservation under declared sources/sinks, valid graph references, and terminal output integrity.
- Cancellation is cooperative and yields a non-success terminal proposal; partial artifacts cannot masquerade as final results.
- Enforce CPU, wall-time, memory, output, event-rate, and graph/demand limits inside compute even if upstream admitted the run.
- Every optimization retains reference fixtures and replay/correctness evidence. Benchmarks identify environment and never replace correctness tests.

Use the simulation-correctness skill for model, numerical, routing-integration, demand, or result-schema changes.
