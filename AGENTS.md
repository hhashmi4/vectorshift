# VECTORSHIFT agent instructions

## Mission and authority

Build an explainable, deterministic urban-disruption experimentation platform. Synthetic results must be labeled as simulations, never traffic observations or forecasts.

Authority descends in this order:

1. The imported `VECTORSHIFT — Staff Engineering Blueprint, RFC 001, November 6, 2026` when available.
2. [The provisional source spec](docs/architecture/source-spec.md) while that PDF is absent.
3. Accepted [ADRs](docs/adr/README.md), then component documentation.
4. Code and tests.

If these disagree, stop, document the conflict, and resolve it with an ADR. Do not silently rewrite architecture.

## Navigation and ownership

- `apps/web`: user interaction, map rendering, accessibility, client recovery; it must not decide authoritative scenario state.
- `services/api`: authentication/abuse controls, command validation, coordination, metadata, and public protocols; it must not contain the simulation engine.
- `services/simulation`: deterministic compute only; no public-user identity or browser transport concerns.
- `packages/contracts`: versioned schemas and protocol types. Consumers depend inward on contracts, not on another deployable's internals.
- `packages/graph`: directed, turn-aware graph model and algorithms.
- `packages/mapping`: PMTiles and visualization data contracts.
- `packages/design-system`: accessible UI primitives and tokens, not domain state.
- `tools/data-pipeline`: licensed source ingestion and reproducible publication.
- `tools/benchmarks`: benchmark harnesses and baselines; never hand-edit results.
- `infra`: deployment definitions only. Infrastructure changes require explicit review and matching operations docs.

Read the nearest nested `AGENTS.md` before changing `apps/web`, `services/simulation`, or `infra`.

## Required engineering behavior

- Make small, reviewable changes with one clear purpose.
- Preserve deterministic behavior: all nondeterminism must be explicit, seeded, versioned, and captured in a run manifest.
- Treat published maps, graph versions, and run manifests as immutable. Publish replacements under new content-addressed or monotonic versions.
- Maintain scenario revision checks, idempotency keys, fencing, sequence ordering, recovery, budgets, and backpressure as documented invariants.
- Use integer/fixed-point or explicitly controlled floating-point semantics where cross-runtime reproducibility matters. Test the chosen policy.
- Add or update tests with behavior changes. Include negative, retry, race, and recovery cases where relevant.
- Update contracts and documentation in the same change as architecture or externally visible behavior. Significant decisions require an ADR.
- Record benchmark environment, dataset version, command, warmup, repetitions, distribution, and limitations. Never invent results.
- Do not add a service, database, queue, cloud resource, dependency, or CI secret silently. Explain need, ownership, cost, failure mode, and rollback.
- Do not commit secrets, private data, unlicensed extracts, large map assets, generated runs, dependency caches, or machine-specific paths.

## Build and verification

Run the narrowest relevant checks during development and the repository check before handoff. Until implementation phases add component tooling, use:

```sh
npm run check
```

Future component READMEs must list exact build/test commands. Tests must be hermetic by default and use small, attributed fixtures. Network and paid-cloud tests are opt-in and must have explicit budgets.

## Security and licensing

Assume anonymous clients are hostile. Validate at trust boundaries, enforce request and compute quotas server-side, authorize HTTP and WebSocket access independently, and avoid exposing private administrative operations on public routes. Use least-privilege credentials and documented secret stores; local `.env` files stay untracked.

All geospatial inputs require provenance, license, attribution, permitted-use, and publication records. Do not mix incompatible licenses or publish raw provider data without review. Security-sensitive findings follow [SECURITY.md](SECURITY.md).

## Definition of Done

A change is done only when:

- acceptance behavior and non-goals are clear;
- code, schemas, docs, and ADRs agree;
- relevant unit, contract, integration, deterministic replay, and failure-path checks pass;
- resource budgets, observability, privacy, security, accessibility, and licensing impacts were considered;
- generated artifacts are reproducible and not committed accidentally;
- rollback or compatibility strategy exists for deployed or persisted changes;
- the handoff states checks run, known limitations, and follow-up decisions.

Use `.agents/skills` only when their review is relevant and explicitly selected. Their outputs are review evidence, not automatic approval.
