# ADR 0001: Monorepo and development toolchain

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Staff engineering

## Context

Web, edge API, contracts, graph tooling, simulation, infrastructure, and cross-component tests will evolve together. Phase 0 must support atomic contract changes without forcing premature service repositories.

## Decision drivers

- Cross-language contract consistency and reviewability.
- Reproducible local/CI setup on macOS ARM64.
- Clear deployable ownership without unnecessary orchestration.

## Considered alternatives

- Multiple repositories improve independent permissions/releases but make early schema changes and end-to-end verification costly.
- A monolith reduces boundaries but couples deployment and domain internals.
- A workspace monorepo preserves atomic changes while retaining component contracts.

## Decision

Use one repository with npm workspaces for Node/TypeScript packages and separately locked Python tooling/services. Node 24 is the JavaScript baseline. Python 3.13 is the initial dependency-validation baseline; test 3.14 separately before support. Each deployable owns its build and lock scope, while root scripts orchestrate checks. Do not introduce a remote build system until repository scale demonstrates need.

## Consequences

Contract migrations and integration tests are atomic, and governance is centralized. CI must avoid rebuilding everything unnecessarily; language toolchains need explicit boundaries and compatible generated schemas.

## Risks

An unconstrained monorepo can become tightly coupled or slow. Ownership rules, dependency direction, affected checks, and size monitoring mitigate this.

## Revisit triggers

Revisit if access/legal isolation is required, release trains cannot be decoupled, CI targets cannot remain bounded, or a component needs a different governance lifecycle.
