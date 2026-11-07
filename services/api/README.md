# Public API boundary

This directory will contain the TypeScript Cloudflare Worker public API. It will own HTTP routing, schema validation, access/abuse decisions, request IDs/tracing, coordinator calls, and authorized immutable-result delivery.

It will not execute simulation, decide graph algorithms, store large result bodies, or become an alternate writer for scenario state. The scenario coordinator remains authoritative. Public contracts are defined from `packages/contracts`, with direction in [API contracts](../../docs/architecture/api-contracts.md).

No Worker project or cloud resource exists in Phase 0.
