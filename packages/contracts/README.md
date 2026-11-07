# Contracts package boundary

This package will be the language-neutral source of public/internal schemas: scenario commands, snapshots, run manifests, lifecycle events, stream envelopes, result manifests, errors, and limits. Generated TypeScript/Python bindings must be reproducible and checked for drift.

Contracts use explicit units, schema versions, bounds, unknown-field policy, compatibility rules, and canonical fixtures. Business algorithms do not belong here. No package has been scaffolded in Phase 0.
