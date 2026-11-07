# Product requirements

## Problem and promise

People can see a changed road or flood boundary on a map, but it is difficult to understand the network consequences and the evidence behind them. VECTORSHIFT will offer reproducible synthetic experiments that connect an intervention to route, bottleneck, connectivity, and accessibility changes without pretending to forecast real traffic.

## Primary users

- A curious public visitor exploring a city without creating an account.
- A planner, researcher, journalist, or educator who needs transparent assumptions and reproducible comparisons.
- A contributor validating graph, routing, simulation, or visualization behavior.
- An operator protecting availability, cost, licensing, and user privacy.

## Core journeys

1. **Orient:** open a supported city, understand coverage, data version, simulation disclaimer, and controls.
2. **Intervene:** close an edge, reduce capacity, add a hypothetical flood, or adjust synthetic demand using precise map tools and an inspectable change list.
3. **Run:** choose an explained model/profile, seed if desired, see quota/cost class, submit once, and monitor honest progress.
4. **Explain:** inspect affected routes, bottlenecks, disconnected regions, accessibility changes, confidence/limitations, and the causal evidence chain.
5. **Compare:** hold map/model/demand constant, compare baseline and intervention, and distinguish absolute values from deltas.
6. **Recover/share:** reconnect safely, restore authoritative state, and share an access-scoped immutable result or reproducibility manifest.

## Butterfly Effect Mode

Butterfly Effect Mode is an evidence interface, not an animation toggle. Starting from selected interventions, it highlights a bounded propagation graph:

- directly modified edges and turns;
- routes that changed and their before/after path costs;
- load displacement and newly stressed bottlenecks;
- connectivity components and unreachable origin/destination pairs;
- accessibility deltas at declared thresholds;
- the inputs, algorithms, versions, and filters that produced each claim.

The interface must distinguish causation encoded by the experiment from correlations in aggregate output. It must expose when multiple interventions interact and when attribution is not uniquely identifiable. Explanations link back to immutable baseline and treatment manifests.

## Scenario comparison

Comparison requires a compatibility check. Map, graph, model, demand population, time horizon, units, output schema, and aggregation must match or have an explicit transformation. The UI blocks misleading overlays, explains mismatches, supports synchronized map/legend/selection state, and reports both values and deltas. Users can inspect the evidence behind an aggregate and export a compact manifest before any data export feature is considered complete.

## Functional requirements

- Versioned vector map with keyboard-accessible selection and non-color-only state cues.
- Reversible scenario edit history with server revisions and conflict recovery.
- Deterministic routing and simulation for supported reproducibility scope.
- Honest progress, cancellation, retry, failure, quota, empty, and partial-result states.
- Ordered resumable event stream plus HTTP source of truth.
- Access-scoped anonymous scenarios with expiry and abuse controls.
- Reproducibility and limitation metadata attached to every result.

## Non-goals for initial product phases

Live traffic prediction, emergency routing advice, navigation, autonomous-control decisions, city digital-twin fidelity, arbitrary user-uploaded map publication, real-time collaboration, and microscopic vehicle behavior are not initial goals.

## Public-launch acceptance

- A visitor completes orient/edit/run/explain/compare on supported devices without registration.
- Every visible result identifies itself as synthetic and exposes map/model/seed/limitations.
- Deterministic replay, revision races, idempotency, fencing, reconnect, and failure recovery pass automated gates.
- Accessibility meets WCAG 2.2 AA for supported flows, including keyboard and reduced motion.
- Threat model controls, quotas, cost ceilings, incident/rollback procedures, and private administration are exercised.
- Data provenance and attribution are correct; no restricted raw asset is exposed.
- Performance targets have measured baselines on named reference scenarios; no hypothesis is presented as achieved.
