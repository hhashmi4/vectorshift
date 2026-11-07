# Phase 1D reference graph and interactive experience review

- **Review date:** 2026-11-07
- **Graph publication verdict:** Blocked; qualified local engineering use only
- **Visual Experience V1 verdict:** Accepted for the loopback-only local routing application

## Architecture and graph outcome

Phase 1D preserved graph schema 2, routing-support artifact 1, and the graph-package ownership of route legality. The 500 m halo is a new immutable candidate rather than an overwrite. Its partitioned acquisition, deterministic merge, manifest, comparison, and same-machine clean reproduction passed. The detailed [Workstream A review](phase-1d-workstream-a-review.md) and [publication record](../../engineering/reference-graph-publication.md) remain authoritative.

Publication is blocked: eight of 500 fixed-seed paths changed and lack independent source review; 147 concerns remain; via-way support qualifies a returned source-way sequence but cannot search for an alternative; conditional rules lack evaluation context; aggregate motor mode cannot model every exception; a finite halo cannot prove global completeness; and no second supported machine reproduced the candidate. The UI continues to load the Phase 1C baseline and displays its dataset/hash explicitly.

## Interactive architecture

The loopback route handlers and graph engine were not duplicated or exposed publicly. Visual Experience V1 adds a collapsible map-first shell, route setup/evidence inspector, task rail, explicit layer menu, optional vector basemap, graph-only fallback, topology hover, start/destination markers, swap/clear/fit actions, automatic algorithm/mode recomputation, and mobile bottom sheet.

Route and network fetches use independent abort controllers and monotonic generations. A superseded response cannot update route evidence or map geometry. Map style lifecycle reinstalls graph sources after provider/fallback style changes. Basemap layers are rendering context only; toggling them does not change authoritative topology.

OpenFreeMap Liberty was reviewed as a development candidate under terms last updated October 14, 2026. The service is as-is and may change; its specific offline-download limits do not constitute a production availability or unlimited-use guarantee. Production delivery remains an ADR 0002/hosting decision.

## Verification evidence

- Standard documentation, strict TypeScript, graph, and web unit gates pass.
- Graph suite: 26 passing tests; web unit suite: 6 passing tests.
- Browser suite: 7 passing tests covering actual route rendering, reverse swap, stale response cancellation, forced basemap failure fallback, WCAG A/AA automation, graph failure, and unsupported restriction withholding.
- Production Next.js webpack build passes.
- Automated axe initially found tertiary text at 4.22:1; the token was corrected and the rerun has no detected WCAG A/AA violations.
- Manual screenshot inspection at 1440×960 and 390×844 found and fixed a MapLibre style-load race that omitted graph overlays. Final captures show the real 0.53 km/68.0 s/30-edge route and 906 A* expansions. Screenshots are generated into ignored `artifacts/phase1d` by `npm run visual:web`.
- API and browser measurements are recorded in [performance](../../engineering/performance.md); they are local engineering baselines, not field or city-scale proof.

## Residual risks and recommendation

Manual screen-reader sampling, representative physical-device GPU/frame profiling, a long browser memory soak, production basemap delivery, and public security controls remain open. None block the local visual tool; all block a public routing claim.

The next phase should begin deterministic simulation engineering only with an explicitly qualified graph input manifest. Graph-publication blockers remain a parallel prerequisite before results are described as reference-city evidence.
