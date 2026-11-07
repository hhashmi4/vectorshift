# Infrastructure-specific instructions

These rules extend the root [AGENTS.md](../AGENTS.md).

- Never plan/apply/provision, alter DNS, create credentials, or deploy merely because configuration changed; obtain explicit authorization for the environment/action.
- Default commands must target local or preview, never production. Separate accounts/namespaces, credentials, state, cache keys, and budgets.
- Pin providers/actions/images by reviewed immutable version or digest and produce provenance/SBOM where supported.
- Use least privilege, managed secrets, encrypted state, protected deletion, and explicit lifecycle policy.
- Include cost estimates/ceilings, alerts/circuit breakers, observability, migration order, compatibility, rollback, and disaster-recovery impact.
- Review plans for unexpected replacement/deletion and redact secrets from logs and artifacts.

Use the security-review skill for IAM, public exposure, secret, administrative, or cross-environment changes.
