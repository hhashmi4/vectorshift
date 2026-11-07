# Contributing to VECTORSHIFT

VECTORSHIFT is in a foundation phase. Discuss changes that alter architecture, protocols, licensing, deployment topology, or persisted formats before implementing them, then capture the decision in an ADR.

## Workflow

1. Read [AGENTS.md](AGENTS.md), the relevant component README, and applicable ADRs.
2. Define the user or engineering outcome, non-goals, affected invariants, and verification plan.
3. Keep changes narrow. Separate mechanical refactors from behavior changes.
4. Add tests and documentation with the implementation.
5. Run `npm run check` plus component checks introduced in later phases.
6. Open a pull request using the repository template; include security, performance, determinism, data-license, and rollback implications.

Do not include real secrets or large map extracts in examples. Use minimal synthetic fixtures with declared provenance. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Commit and review guidance

Use imperative commit subjects and explain why in the body when the reason is not obvious. Reviewers should be able to validate one conceptual change at a time. Changes to public schemas need compatibility notes; changes to deterministic computation need golden/replay evidence; performance claims need reproducible benchmark artifacts.

## Community standards

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). By contributing, you agree that your contribution is licensed under [Apache-2.0](LICENSE).
