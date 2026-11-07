# Distributed systems, concurrency, and recovery

**Status:** Proposed invariants; implementation designs must preserve them or replace them through an ADR.

## State model

A scenario is an append-only logical command history plus periodic immutable snapshots. The coordinator holds the current `revision`, an epoch/fencing token, a bounded command-id deduplication index, run state, and a monotonically increasing `event_seq`. Durable storage, not a connected browser, is authoritative.

A command envelope contains `scenario_id`, `command_id`, `expected_revision`, operation schema/version, actor/access context, and trace metadata. A run request additionally has an idempotency key and freezes a canonical manifest.

## Invariants and verification

| Concern | Invariant | Required verification |
| --- | --- | --- |
| Revision conflict | Exactly one mutation from revision `r` can create `r+1`; stale writers receive `409` without mutation. | Parallel property/integration test with randomized delivery order. |
| Duplicate command | Reusing a command ID with identical canonical payload returns the original outcome; different payload returns a conflict. | Redelivery test before/after coordinator restart and dedupe compaction. |
| Double-click Run | Same idempotency key and semantic request resolves to one run ID and one manifest. | Concurrent requests at API and coordinator boundaries. |
| Concurrent tabs | Both may draft, but coordinator order wins; loser rebases explicitly against returned authoritative state. | Browser E2E test with two isolated contexts. |
| Cancel vs complete | One terminal state is committed. A completion accepted first stays complete; a cancellation accepted first prevents result promotion. | Barrier-controlled race tests in both orderings. |
| Lease expiry | Only the current fencing token can report progress or commit terminal state. | Pause old worker, re-lease, then deliver old messages. |
| Snapshot publication | A snapshot is visible only after digest verification and carries revision/event watermarks. | Fault injection at each upload/promotion step. |
| Stream ordering | `event_seq` is strictly increasing within an epoch; duplicates are safe and gaps are detectable. | Drop, duplicate, reorder, reconnect, and retention-boundary tests. |
| At-least-once dispatch | Retried delivery does not duplicate semantic execution results or terminal transitions. | Broker/dispatcher redelivery and lost-ack tests. |
| Cache isolation | A cache key includes environment, access scope, scenario/map/graph/model/schema versions, canonical input digest, and representation version. | Pairwise mutation tests proving distinct keys; authorization tests on cached responses. |

## Conflict and idempotency behavior

The coordinator validates authorization and schema again even if the edge already did so. It looks up `command_id` before revision validation: an identical retry can recover its original response after the scenario has advanced. Canonical request digests exclude transport-only values and use a specified serialization. Deduplication retention must exceed every supported client retry window; compaction records a durable receipt or makes the expired behavior explicit.

Idempotency keys are scoped to actor/access grant and operation. They are not a substitute for expected revision. A run created at revision 12 remains tied to its frozen revision-12 snapshot even if the scenario later advances.

## Terminal races and fencing

Run state follows `queued -> leased -> running -> {succeeded, failed, cancelled, expired}`. Terminal states do not transition. The coordinator performs a compare-and-set on state and current fencing token. Result data uploaded by a stale attempt remains unreferenced and is garbage-collected after a safety period; it cannot be promoted as authoritative.

A lease renewal must include run ID, attempt ID, and current fencing token. Clock time is used for liveness, not output semantics. Lease expiry creates a higher token before redelivery. At-least-once delivery is assumed even before a managed queue exists.

## WebSocket resume protocol

Each event carries `scenario_id`, `coordinator_epoch`, `event_seq`, `scenario_revision`, event type/schema, timestamp for display, and payload. The client tracks the last applied sequence.

- Duplicate (`seq <= last_applied`) events are ignored after identity validation.
- Next (`seq == last_applied + 1`) is applied.
- Gap (`seq > last_applied + 1`) pauses delta application and triggers replay from the missing sequence.
- If replay is outside retention or the epoch changed incompatibly, the server returns a recovery-required signal with an authoritative snapshot reference and watermark.

Progress and sampled deltas are disposable; commands and final results remain accessible over HTTP. Backpressure coalesces superseded progress samples but never silently drops state transitions, revision changes, gap markers, or terminal events. Slow consumers are disconnected with an explicit resumable reason before server memory becomes unbounded.

## Cache safety

Immutable public map assets may use long-lived cache headers because their URL includes a content/version identity. Mutable scenario reads use short or revalidated caching and an authorization-aware key. Results are immutable but may be private/unlisted; a signed URL is not permission to place data in a shared public cache. Invalidation creates a new namespace or version; it never mutates content behind an immutable key.

## Model checking and fault injection

Before public launch, encode the scenario/run state machine in a model or property-based harness and assert uniqueness of revisions, terminal state, and promoted results. Integration tests must inject lost acknowledgements, duplicates, reordering, coordinator restarts, object-store partial writes, compute crashes, lease expiry, delayed stale workers, and quota exhaustion.
