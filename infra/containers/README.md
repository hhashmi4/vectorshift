# Simulation container boundary

Future definitions will build a non-root, minimal, multi-architecture simulation image with pinned dependencies, health/readiness semantics, resource limits, SBOM/provenance, and no embedded credentials or datasets.

The image will accept immutable manifest references through an authenticated internal protocol and write only staged/immutable outputs. The supported Python version follows dependency evidence; no image exists in Phase 0.
