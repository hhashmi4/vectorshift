# UI architecture and design specification

## Product character

The interface is a professional engineering instrument: quiet, dense enough for serious inspection, and legible under uncertainty. The map remains the primary workspace. Controls exist to operate and explain the model, not decorate it.

## Workspace architecture

```text
┌──────────────── command bar: city · versions · undo/redo · run status ───────────────┐
│ scenario tools │                         map                            │ inspector    │
│ interventions │  selected network, overlays, comparison, annotations  │ evidence     │
│ demand/model  │                                                        │ parameters   │
├───────────────┴──────────────── timeline / legend / event status ──────┴──────────────┤
│ disclosure: synthetic simulation · limitations · versions · accessibility controls   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

On smaller screens, scenario tools and inspector become mutually exclusive drawers; the map and run/error state remain visible. URL state may encode non-sensitive view state, never bearer credentials or unsaved authoritative commands.

## Visual language

- Charcoal/slate/neutral surfaces; one cool primary accent for selection and action.
- Amber signals degradation or caution; red is reserved for severe disruption, invalid/destructive action, or terminal failure. Neither is the sole state cue.
- Tabular numerals for metrics and sequence/revision identifiers. Use a restrained sans-serif family with clear zero/O and one/l distinctions.
- A compact 4 px spacing foundation, with 28–36 px control heights where accessibility permits and consistent focus rings.
- CSS semantic tokens (`surface`, `text`, `border`, `accent`, `warning`, `danger`, `map-*`) isolate intent from palette. Light/dark/high-contrast themes remain possible.
- No glow effects, decorative gradients, oversized cards, or metrics without a decision purpose.

## Component boundaries

The Next.js shell owns routing and server-renderable explanatory content. A client-only map workspace owns MapLibre lifecycle. Domain state is split into authoritative scenario/run state, local drafts, view state, and derived visualization state; these stores cannot overwrite one another implicitly. `packages/design-system` owns accessible primitives/tokens, while domain composites stay in `apps/web`.

MapLibre renders the basemap and ordinary network overlays. Custom GPU layers or deck.gl require a measured need, a hit-testing/accessibility plan, and a performance comparison. Visual layers consume versioned view models rather than coordinator events directly.

## Interaction and feedback

- Editing uses a visible mode, pointer and keyboard paths, snapping/selection feedback, explicit units, and an ordered change list.
- Run controls show the frozen revision and resource profile. Repeated activation is safe and resolves to the same admitted run when appropriate.
- Tooltips are contextual but never the only location for essential labels, limitations, or errors.
- Loading uses stable layout and meaningful stages. Empty states explain the next valid action. Errors state what happened, whether work was applied, and how to recover.
- Stream gaps pause potentially misleading deltas and show recovery; stale state is never silently displayed as current.
- Comparison provides synchronized legends, baseline/treatment labels, delta direction, and a compatibility warning before display.

## Accessibility and motion

Target WCAG 2.2 AA. All commands, map feature inspection, legends, change lists, dialogs, and evidence navigation need keyboard operation and visible focus. Provide a non-map table/list representation for essential selected-feature and result data. Announce run transitions and conflicts through appropriately scoped live regions. Respect `prefers-reduced-motion`; animation communicates temporal evolution only when useful and has pause/scrub controls.

## Review gates

Each major flow needs responsive states, keyboard walkthrough, automated accessibility checks, manual screen-reader sampling, contrast evidence, reduced-motion behavior, and tests for loading/empty/error/conflict/reconnect/quota states. The [frontend review skill](../../.agents/skills/frontend-design-review/SKILL.md) structures review when implementation begins.

## Visual Experience V1 implementation

Phase 1D implements the routing workspace with semantic CSS tokens rather than a new dependency: five neutral surface levels, two separator strengths, primary/secondary/tertiary text, cyan interaction/route, green confirmation, amber qualification, and red blocking states. The spacing scale is 4/8/12/16/20 px; controls use 3–5 px radii and 34–36 px heights; tabular numerals and monospaced identifiers keep evidence aligned. Elevation is reserved for transient layer controls and the mobile sheet.

Reusable `IconButton`, `StatusPill`, and line-icon primitives provide consistent focus, hover, disabled, and accessible-name behavior. Domain composites remain in `apps/web`; they do not move graph or routing ownership into a design-system package.

The desktop hierarchy is a 48 px command bar, 64 px task rail, primary map, 372 px collapsible inspector, and 28 px disclosure strip. At 720 px and below the task rail becomes a compact map toolbar and the inspector becomes a bounded bottom sheet rather than a compressed desktop column. Essential route evidence remains textual. Reduced-motion mode disables nonessential transitions and uses immediate map fitting.

The vector basemap is contextual rendering only. Authoritative topology, selection points, and ordered route geometry are separate GeoJSON sources and layers. Layer toggles can remove basemap context without affecting routing. If style acquisition fails, the app reinstalls the same overlays on a dark graph-only style and reports that state in the layer control.
