---
name: architecture-review
description: Review a VECTORSHIFT architectural proposal or cross-boundary change for authority, invariants, ownership, compatibility, operations, and ADR completeness. Use for new components, protocols, persistence, deployment topology, or significant dependency direction; not for routine local refactors.
---

# Architecture Review

Produce decision-ready review evidence without implementing or approving the change automatically.

## Inputs

Obtain the proposal/diff, stated outcome and non-goals, affected components/data/contracts, relevant ADRs, expected workloads, failure assumptions, migration/rollback plan, and unresolved questions. If evidence is missing, label it rather than inventing it.

## Workflow

1. Resolve authority in order: imported RFC, provisional source spec, accepted ADRs, component docs, then code/tests. Report conflicts.
2. Trace control, compute, and data flows across trust and ownership boundaries. Identify the authoritative writer and system of record for every mutable state.
3. Test the proposal against determinism, immutability, revision/idempotency, fencing, terminal races, event ordering/recovery, budgets/backpressure, cache isolation, and public-access security.
4. Examine schema/version compatibility, data migration, rollout/rollback, observability, licensing, privacy, cost, and local/testability consequences.
5. Compare credible alternatives and the status quo against explicit decision drivers. Distinguish measured facts, constraints, hypotheses, and preferences.
6. Decide whether an ADR must be created, amended, or superseded and list verification needed before acceptance.

## Checks

- Dependencies point inward through contracts rather than deployable internals.
- No new service/database/queue/provider/dependency is introduced without ownership, failure, cost, and rollback reasoning.
- Large immutable data is separate from compact mutable coordination state.
- Claims match repository capability and performance evidence.
- Security/data-license/accessibility effects have named owners and gates.

## Output

Return: scope reviewed; authority and diagrams/flows inspected; blocking findings; important non-blocking findings; alternatives/trade-offs; required ADR/doc/test changes; evidence gaps; and a verdict of `ready`, `ready with conditions`, or `not ready`. Cite repository files/sections. A verdict is review advice, not permission to provision or deploy.
