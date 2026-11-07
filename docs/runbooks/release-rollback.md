# Release and rollback runbook

**Status:** Template; no deployable system exists in Phase 0.

## Before release

Confirm change scope, approvals, CI evidence, compatibility matrix, schema/state migration plan, artifact digests/provenance, cost impact, capacity, observability, feature-flag defaults, data-license impact, rollback decision point, and incident owner. Exercise staging with representative synthetic scenarios and a deterministic replay fixture.

## Release

1. Record current versions/configuration and health baseline.
2. Promote the already-built artifact; do not rebuild per environment.
3. Apply backward-compatible configuration/state changes before dependent code.
4. Run bounded smoke tests for create/edit/run/status/result/stream recovery.
5. Observe errors, latency, saturation, correctness counters, spend, and stream gaps for the declared window.
6. Announce completion with versions and limitations.

## Rollback

Rollback when correctness, security, data integrity, cost, or agreed health thresholds breach. Stop new expensive admissions first if needed, preserve status/result reads, and route traffic to the last compatible artifact. Never roll code behind an irreversible state migration. If state compatibility is uncertain, enter a safe read-only/degraded mode and follow the incident process.

Verify old-version health, scenario/run state, stale-worker fencing, stream reconnection, cache namespace, and object integrity. Record timeline, affected identifiers, mitigations, and follow-up. Immutable map/result objects are not overwritten during rollback.
