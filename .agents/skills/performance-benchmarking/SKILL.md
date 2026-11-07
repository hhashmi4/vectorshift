---
name: performance-benchmarking
description: Design, run, or review reproducible VECTORSHIFT browser, API, graph, simulation, streaming, memory, or cost benchmarks. Use when establishing a baseline, validating a target, or evaluating an optimization; not for unsupported performance guesses.
---

# Performance Benchmarking

Turn a performance question into reproducible evidence while preserving correctness.

## Inputs

Define the decision, metric and boundary, target hypothesis, workload/versions/seeds, correctness oracle, hardware/OS/architecture/runtime/build flags, cache/warmup state, repetitions/statistics, resource ceiling, and allowed cost. If paid or external execution is not already authorized, prepare the procedure without running it.

## Workflow

1. State one falsifiable question and confounders. Select representative and pathological workloads without using restricted data.
2. Pin commit/build, environment, map/graph/model/schema/demand, command, instrumentation, and output location. Keep large raw output outside Git and retain checksum/provenance.
3. Verify correctness before timing. Separate cold/warm, setup/steady-state, client/server, and authoritative/disposable event paths as relevant.
4. Run warmup and enough repetitions to report distribution and variance. Monitor CPU, memory, I/O/network/GPU, output size, and cost inputs; stop at the declared safety ceiling.
5. Compare distributions using a predeclared regression threshold. Reproduce surprising regressions and improvements; inspect profiles before proposing optimization.
6. Publish a small reviewable summary with exact reproduction command, limitations, and raw-artifact reference.

## Checks

- Results are not generalized beyond the tested environment/workload.
- Median plus tail/variance and sample count replace best-run claims.
- Resource/cost changes and correctness equivalence accompany latency/throughput.
- Hypotheses, estimates, measured values, and accepted targets are labeled separately.

## Output

Provide decision/question, complete environment/workload manifest, method, correctness result, measurements with units/distribution, resource and cost observations, artifact/checksum locations, limitations, conclusion, and recommended next experiment. Never synthesize absent measurements.
