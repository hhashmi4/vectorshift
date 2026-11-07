---
name: frontend-design-review
description: Review a VECTORSHIFT user flow or map visualization against the map-first instrument design, accessibility, state ownership, honest simulation language, and measured responsiveness. Use for material UI, map-layer, interaction, or design-system changes; not for backend-only changes.
---

# Frontend Design Review

Evaluate whether the interface helps a user operate and understand a synthetic experiment without obscuring state or evidence.

## Inputs

Obtain user journey, screenshots/prototype or diff, viewport/device scope, state model, keyboard behavior, loading/empty/error/conflict/reconnect states, map layer/legend specification, performance measurements, and linked product requirements.

## Workflow

1. Walk the core task from orientation through edit, run, explain, compare, and recovery as applicable. Verify map primacy and clear next actions.
2. Separate authoritative scenario/run state, local draft, view/URL state, and derived visualization; flag implicit overwrites or stale displays.
3. Inspect visual hierarchy, semantic tokens, numerical alignment, severity color use, compactness, tooltip purpose, and evidence/limitation visibility.
4. Exercise keyboard-only use, focus order/traps/restoration, accessible names, non-map equivalents, live announcements, contrast, zoom/reflow, and reduced motion.
5. Inspect loading, empty, validation, revision conflict, quota, offline, stream gap, partial, cancellation, and terminal error behavior relevant to the change.
6. Require representative input/render/memory/transfer evidence for performance claims or new GPU/deck.gl complexity.

## Checks

- Synthetic simulation and versions/limitations remain visible where results are interpreted.
- Amber/red encode real severity and are never sole cues; decorative gradients/glows do not replace information hierarchy.
- Essential content does not exist only in hover/tooltips or the map canvas.
- Reconnection cannot silently show stale deltas as authoritative.

## Output

Return journey reviewed, state/interaction findings, accessibility findings, visual/evidence findings, performance evidence gaps, required tests, and verdict `ready`, `ready with conditions`, or `not ready`. Attach reproducible steps for each blocking state.
