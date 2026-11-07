# Security and abuse threat model

**Status:** Phase 0 design; controls require implementation and verification before public launch.

## Assets and trust boundaries

Assets include service availability, compute budget, scenario/result confidentiality, access grants, administrative authority, licensed map data, object integrity, deterministic manifests, build/release integrity, and observability data. Trust boundaries exist at browser-to-edge, edge-to-coordinator, coordinator-to-compute, compute-to-object-store, CI-to-deployment, and administrative interfaces.

Anonymous does not mean unauthenticated. A public visitor receives a scoped, expiring capability/session that can be rate-limited and revoked without collecting unnecessary identity. IP or device signals may support abuse defense but are noisy, privacy-sensitive, and never the sole authorization mechanism.

## Threats and planned controls

| Threat | Controls | Verification |
| --- | --- | --- |
| Resource/cost exhaustion | Layered request, scenario, run, CPU, memory, output, stream, and concurrency quotas; admission control; hard worker limits; global spend circuit breaker | Load, quota-boundary, and fail-closed tests; cost alerts/game days |
| Input amplification | Strict schemas, bounded arrays/geometry/precision, decompression limits, early content-length checks, canonicalization complexity limits | Fuzz/property tests and worst-case fixtures |
| Rate-limit evasion | Scoped grants plus coarse network/reputation signals, distributed counters with explicit fail mode, escalating cooldown | Multi-region/reconnect abuse simulations |
| Cross-origin misuse | Exact production origin allowlist, no reflected origins, appropriate SameSite/CSRF defenses, preflight tests | Browser integration tests |
| WebSocket hijack/abuse | Authorize at handshake and on scenario access, validate Origin, short-lived scoped credential, message/connection/egress limits, revalidation on revocation | Cross-origin, expired-token, replay, slow-consumer tests |
| Scenario/result disclosure | Unpredictable IDs plus actual authorization, capability scoping, no shared-cache leaks, sanitized logs, expiry/deletion policy | IDOR matrix and cache tests |
| Command replay/confusion | Expected revisions, actor-scoped command IDs/idempotency, canonical payload digest, schema versions | Duplicate and cross-scope replay tests |
| Malicious map/data input | Pipeline isolation, provenance/license review, size/structure bounds, no untrusted executable formats, output validation | Parser fuzzing and supply-chain review |
| Secret leakage | Managed secret stores, least privilege, environment separation, log redaction, rotation runbook, CI secret scanning | Rotation exercise and canary checks |
| Dependency/build compromise | Lockfiles, provenance, review of install scripts, dependency scanning, pinned CI actions by immutable commit, SBOM/signing roadmap | CI policy checks and release verification |
| Admin takeover | Private identity-aware access, phishing-resistant MFA, separate admin origin/service, audited just-in-time roles, no public debug endpoints | Access review and incident exercise |

## Validation and privacy

Validation occurs at each boundary even when upstream validated. Domain operations reference version-scoped IDs rather than accepting arbitrary storage paths or queries. Error messages do not disclose existence of inaccessible scenarios. Geometry is normalized with declared CRS, coordinate/vertex bounds, and topology rules. Serialization is canonical where signatures or idempotency depend on it.

Collect the least telemetry needed. Hashing an identifier does not automatically anonymize it. Define retention for IP-derived signals, access logs, scenarios, results, and traces; restrict access and support deletion semantics consistent with immutable shared map assets.

## Administrative separation

Administrative functions—quota overrides, moderation, object repair, release promotion, secrets, and user/session investigation—must not share public routes or public credentials. Destructive actions require explicit targets, dry runs where possible, audit records, and stronger authorization. Support tooling must not bypass scenario authorization silently.

## Security gates

Before public launch: resolve the private reporting contact, complete data-flow and abuse reviews, implement security headers/CORS/CSP, exercise quotas and spend circuit breakers, run dependency/container scans, perform IDOR and WebSocket tests, review cloud IAM, rotate credentials, verify backups/restores, and commission an independent review for exposed critical paths.
