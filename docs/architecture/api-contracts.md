# API contract direction

**Status:** Proposed; exact schemas will be published from `packages/contracts` in a later phase.

All public endpoints are versioned under `/v1`, use JSON unless documented otherwise, reject unknown security-sensitive fields, return a request ID, and expose stable machine-readable error codes. IDs are opaque. Timestamps are RFC 3339 UTC display metadata; they do not determine simulation output.

## Command envelope

Every mutation contains:

```json
{
  "command_id": "opaque-client-generated-id",
  "expected_revision": 7,
  "operation": {
    "type": "road.capacity.set",
    "schema_version": 1,
    "edge_id": "version-scoped-edge-id",
    "capacity_ratio_ppm": 500000
  }
}
```

The same `command_id` and canonical payload returns the original outcome. Reuse with a different payload returns `409 command_id_reused`. A stale `expected_revision` returns `409 revision_conflict` with the current revision and an authorized recovery reference; it never applies implicitly.

## Initial resources

### `POST /v1/scenarios`

Creates an access-scoped scenario against explicit `map_version`, `graph_version`, and scenario schema. The creation command is idempotent. Response includes scenario ID, revision 0, access capabilities, expiry policy, and canonical document.

### `PATCH /v1/scenarios/{id}`

Applies one typed command envelope. Batch mutation, if introduced, must define atomicity explicitly. Success returns the new revision and canonical affected state.

### `POST /v1/scenarios/{id}/runs`

Requires `command_id`, `idempotency_key`, `expected_revision`, requested model/version, seed, output profile, and acknowledged resource class. Admission freezes and returns a manifest digest and run ID; `202` means accepted, not completed. Quota/capacity rejection uses `429`/`503` with bounded retry guidance.

### `GET /v1/runs/{id}`

Returns authoritative lifecycle state, manifest identity, progress summary, terminal reason, and result availability. It does not return large sampled deltas.

### `GET /v1/runs/{id}/results`

Returns a result manifest or authorized references to immutable objects. Partial results are clearly marked and never served as a successful final result.

### `WS /v1/scenarios/{id}/stream`

Connection authorization is independent of prior HTTP calls. The client supplies the last applied sequence or snapshot watermark. Events follow the ordering and recovery rules in [distributed systems](distributed-systems.md). Credentials must not appear in query strings where logs could retain them.

## Errors and compatibility

Errors use this minimum shape:

```json
{
  "error": {
    "code": "revision_conflict",
    "message": "The scenario changed before this command was applied.",
    "request_id": "opaque-id",
    "details": {}
  }
}
```

Messages are safe for people; clients branch on `code`. Additive response fields are compatible. Removing/renaming fields or changing semantics needs a version strategy and migration window. Contract tests must run against TypeScript and Python representations and canonical fixtures.

## Limits

Each route will publish maximum body size, command rate, active scenarios, concurrent runs, run budget, stream connections, and event size before public availability. Limits are enforced before expensive parsing or dispatch where possible and may vary by trusted access class without relying on client declarations.
