# Phase 1D Workstream A review

- **Scope:** bounded halo acquisition, restriction/access safety, graph comparison, integrity manifest, and reproduction
- **Verdict:** Workstream A gate complete with explicit publication blockers; external publication not ready

Authority and accepted ADRs remain consistent. Graph schema version 2 and routing-support artifact version 1 did not change. The expanded graph is a new immutable dataset rather than an overwrite. The acquisition and local adapter remain outside the graph domain, and no infrastructure or public service was introduced.

The partitioned acquisition succeeded within explicit geographic, response, aggregate-byte, concurrency, and retry limits. The candidate materially improves connectivity and eliminates boundary-sensitive classification for the 500 sampled core pairs, but eight optimal paths changed and restriction concerns rose from 77 to 147. These are evidence to review, not proof of correctness.

Restriction handling remains fail-closed at presentation: supported via-node rules are enforced during search; ambiguous exceptions compile only unambiguous supported modes; candidate paths intersecting conditional, via-way, mode-specific, exception, or unresolved concerns are withheld with source relation diagnostics. New fixtures verify ordered via-way concern matching and reject false matches. Full via-way alternative routing and conditional evaluation were not introduced without the required state/context.

The clean same-machine build reproduced graph and support hashes. Second-machine verification remains absent. The machine-readable publication manifest therefore records `publication_status: blocked`.

Workstream B may proceed because the Workstream A outcome and blockers are now explicit; the UI must continue to identify the active baseline dataset and must not imply that the halo candidate is published or legally complete.
