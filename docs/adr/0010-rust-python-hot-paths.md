# ADR 0010: Python first; Rust only for measured hot paths

- **Status:** Proposed
- **Date:** 2026-11-06
- **Owners:** Simulation and performance

## Context

Python supports rapid, inspectable model development, while Rust may improve predictable performance and memory safety for graph/simulation kernels. Premature dual-language implementation would slow correctness work.

## Decision drivers

- Deterministic correctness, profiling evidence, developer velocity, packaging on ARM64/Linux, memory/throughput, and cross-language complexity.

## Considered alternatives

- All Python minimizes language surface but may miss throughput targets.
- All Rust improves control/performance but raises initial model iteration cost.
- Python orchestration/model first with optional Rust kernels bases complexity on evidence.

## Decision

Implement the correctness reference and initial engine in typed Python with explicit numerical/data-layout policy. Profile accepted reference workloads. Move a stable kernel to Rust only when an experiment shows that algorithmic/data-layout optimization in Python cannot meet an accepted budget and the FFI/build/replay cost is justified. Keep identical contract fixtures and a reference implementation.

## Consequences

Model behavior remains readable early and optimization has a baseline. A later Rust boundary may add build, packaging, debugging, and semantic duplication.

## Risks

Python 3.14 dependency support is unproven; Python performance and GIL/process overhead may be material; Rust/Python numeric differences may break replay. Validate Python 3.13/3.14 dependencies and define equivalence before implementation.

## Revisit triggers

Accept Python-only when measured targets have margin; introduce a Rust ADR after profiles identify stable hot paths and a prototype demonstrates reproducible net benefit on supported platforms.
