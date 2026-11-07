# Phase 1C routing hardening and map review

- **Review date:** 2026-11-06
- **Verdict:** Accepted for a qualified local routing demonstration; not accepted for public or navigation-like routing

## Acceptance review

Phase 0–1B instructions, ADRs, graph/routing contracts, manifests, tests, roadmap, nested instructions, and the architecture, simulation-correctness, frontend, and performance review skills were applied. The original RFC PDF is still absent, so no reconciliation was possible. The starting `npm run check` passed independently before implementation. The repository still has no commit; all intended source files remain untracked and ignored raw/derived/build/dependency files remain outside the commit candidate.

The design preserves the accepted domain boundary. Pipeline 3 changes source interpretation but not graph schema v2. Unresolved semantics live in a deterministic graph-bound sidecar. The Next adapter calls the graph package and remains loopback-only. No simulation, public API, cloud service, persistence product, or infrastructure was introduced.

## Restriction audit

Of 133 restriction relations, 56 are fully imported and 12 have an unambiguous bicycle part imported. The resulting graph has 82 mode-scoped turn rules. Seventy-seven source concerns remain: 39 conditional relations affecting bicycle and motor vehicle; 23 aggregate motor-vehicle exception ambiguities; 2 unsupported bicycle two-stage-turn-box values; 2 via-way sequences affecting bicycle and motor vehicle; and 11 unresolved transitions affecting both modes.

Every relation carries generated rule IDs, and every concern carries source way/node members, affected modes, exception values, and a diagnostic. A candidate route intersecting one is withheld with relation IDs. Conditional cases remain unsupported because Phase 1C has no evaluation instant or vehicle context. Via-way restriction enforcement and alternative-path search are not implemented. U-turn policy is explicitly `source_rules_only`.

## Boundary findings

All 594 outside nodes are explained by retained ways crossing the acquisition box; there were no unexplained outside nodes. In the fixed-seed sample, 297/500 routes across the full largest motor SCC were boundary-sensitive, compared with 65/500 when endpoints were more than 100 m inside. This validates the need for route qualification but does not validate the buffer as sufficient. A precise, capped 500 m halo query is prepared. Two endpoint attempts hit the 120-second timeout without producing bytes, so the halo comparison remains open rather than being inferred.

## Reproducibility and verification

An isolated temporary copy ran `npm ci --ignore-scripts` and rebuilt the graph from the pinned raw bytes. It reproduced graph SHA-256 `c12c4523e0b43725d6ad843816593395b6a0e780408c8009dc928756105c6573` and support SHA-256 `a4b8c49ec359cad6b70e947b012e6e01f8d0b984b2d066f734c61666fe362eae`. A committed tiny synthetic golden artifact additionally fixes canonical graph and serialized-byte hashes. This was the same Apple M4 machine, not a second-machine validation.

The final standard gate passed documentation validation, strict root/web TypeScript, 24 graph tests, and 6 web unit tests. The webpack production build passed. Four system-Chrome browser tests passed: actual graph/route workflow, automated WCAG A/AA scan with no detected violations, recoverable network failure, and explicit withholding of unsupported route evidence. The browser tests do not replace manual assistive-technology or representative GPU testing.

## Performance evidence

The loopback production-server benchmark ran 200 alternating A*/Dijkstra requests after 10 warmups. Round-trip latency was 5.27 ms median, 6.71 ms p95, and 7.29 ms p99; server compute was 4.33/5.22/5.68 ms. The first network response was 1,288,019 bytes and took 568.77 ms after process start. All emitted static JS/CSS was 2,070,592 bytes raw and 588,691 bytes when individually gzip-compressed. These are one-machine engineering measurements, not city-scale proof, SLOs, or browser responsiveness evidence.

## Residual conditions and next work

Do not publish routes as legal advice or navigation. Conditional and via-way semantics, aggregate transit exceptions, 11 unresolved source transitions, access-law completeness, boundary truncation, halo comparison, second-machine reproduction, representative browser frame/memory testing, and production tile delivery remain open. The recommended next task is Phase 1D, the reference graph publication gate, before simulation treats this dataset as a stable city input.
