---
name: security-review
description: Threat-model and review a VECTORSHIFT public API, WebSocket, scenario/result access, data pipeline, dependency, CI, cloud, container, secret, or administrative change. Use for new trust boundaries, public exposure, permissions, sensitive data, abuse/cost risk, or release gates; not as a substitute for private incident handling.
---

# Security Review

Review adversarial behavior and operational abuse without expanding authorization to probe live systems.

## Inputs

Obtain scope/non-goals, data-flow/trust-boundary diagram, assets/data classes, actors/capabilities, endpoints/protocols, identity/access model, input/resource limits, dependencies/build path, infrastructure permissions, logging/retention, admin functions, and rollout/rollback. Mark unknowns.

## Workflow

1. Enumerate assets and entry/egress points across browser, edge, coordinator, compute, object storage, CI, and administration as applicable.
2. Analyze identity/confused-deputy, authorization/IDOR, command replay, injection/parser complexity, cross-origin/CSRF, WebSocket hijack, cache leakage, SSRF/path/object reference, secret/log leakage, dependency/build compromise, denial/cost exhaustion, and admin misuse.
3. For each material threat, record precondition, impact, existing control, control owner, verification, residual risk, and fail-open/closed behavior.
4. Verify validation at every trust boundary, least privilege/environment separation, scoped expiring grants, bounded work/backpressure, private administration, and auditable destructive actions.
5. Define negative/fuzz/load tests, monitoring/alerts, incident/rotation/rollback actions, and release blockers. Do not place exploit details in public artifacts when they would increase risk.

## Checks

- Anonymous access still has server-enforced authorization, quotas, revocation, and retention.
- HTTP success does not implicitly authorize WebSockets or object-store reads.
- Shared caches cannot cross access/environment/scenario boundaries.
- No secret or bearer credential appears in URL, client storage, logs, fixtures, image, or repository.
- New dependency/provider/permission has provenance, owner, update plan, and rollback.

## Output

Return scope/diagram reviewed, prioritized findings with severity rationale and evidence, concrete remediations/owners, required tests/telemetry/runbook changes, accepted residual risks needing owner approval, and verdict `ready`, `ready with conditions`, or `not ready`. Report suspected vulnerabilities through the private process in `SECURITY.md`.
