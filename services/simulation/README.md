# Simulation service boundary

This directory will contain deterministic Python simulation code and a narrow internal FastAPI compute interface where needed. The engine consumes immutable run manifests and versioned graph/demand inputs, emits progress plus immutable results, and has no public-user authentication responsibilities.

The initial model is mesoscopic, fixed-step, and seeded. Python dependency support must be evaluated on 3.13 and separately on 3.14 before a runtime is declared supported. Rust is not a default requirement; [ADR 0010](../../docs/adr/0010-rust-python-hot-paths.md) requires profiling evidence.

No service or dependency environment exists in Phase 0. Read the local [AGENTS.md](AGENTS.md) before implementation.
