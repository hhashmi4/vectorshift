# CI/CD, release, and change control

## CI stages

The Phase 1B workflow installs the exact lockfile with `npm ci`, then runs documentation-link checks, strict TypeScript verification, and graph/routing tests through `npm run check`. Later stages will be added only with their components:

1. repository policy, formatting, generated-file cleanliness, secret/license checks;
2. TypeScript/Python lint, type, unit, and contract tests;
3. deterministic replay and cross-runtime schema fixtures;
4. integration/fault tests with local emulators and bounded containers;
5. web accessibility and end-to-end journeys;
6. container/SBOM/dependency vulnerability scans;
7. scheduled performance/soak benchmarks on controlled runners.

Pull-request jobs must not deploy or require production secrets. CI actions will be pinned to immutable commit SHAs when introduced. Cache keys include lockfile, runtime, architecture, tool, and schema versions; caches accelerate builds but never supply release provenance.

## Delivery model

Build once, produce checksummed artifacts and provenance, promote the same artifact through staging to production, and keep web/API/coordinator/compute/schema compatibility explicit. Database-style migrations are absent initially, but Durable Object state and object manifests still need forward/backward readers and staged migration plans.

Production promotion is an authorized, auditable action with environment checks, smoke tests, metrics observation, and a rollback owner. Infrastructure changes show a reviewed plan and cost impact. No CI workflow may silently create a paid service.

## Branch and release policy

The default branch remains releasable after implementation begins. Tagged releases include changelog, supported schema/model/map compatibility, artifact digests, SBOM/provenance, known limitations, and rollback instructions. Security fixes may use coordinated disclosure and an abbreviated review path without skipping verification.
