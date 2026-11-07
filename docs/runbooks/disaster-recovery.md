# Disaster recovery runbook

**Status:** Design checklist; recovery objectives and provider commands are unresolved.

## Priorities

Protect people and credentials, stop corruption/cost amplification, preserve evidence, restore authoritative control state, restore immutable object access, then re-enable compute admission. Synthetic simulation availability never justifies unsafe infrastructure action.

## Recovery outline

1. Declare incident scope and freeze releases/destructive lifecycle jobs.
2. Revoke or rotate compromised credentials and isolate affected environments.
3. Preserve logs, manifests, configuration, and object inventories with access controls.
4. Restore coordinator state from the latest verified snapshot plus command suffix; validate revision, epoch, event watermark, and dedupe receipts.
5. Inventory map/graph/result manifests and verify referenced object digests.
6. Advance fencing epochs before dispatch resumes so pre-incident workers cannot commit.
7. Restore read paths, then scenario commands, then bounded compute admission.
8. Run deterministic replay and stream gap/recovery smoke tests.
9. Reconcile abandoned attempts/staging objects only after the recovery grace period.

Do not infer success from service health alone. Verify representative scenario state, command idempotency, result-to-manifest linkage, access control, and cost/queue behavior. Record measured recovery time and data-loss window; use exercises to propose RTO/RPO rather than inventing them.
