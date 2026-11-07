# Worldwide map and local routing architecture

**Status:** Worldwide exploration foundation and local engineering routing validation; not a public API, navigation product, or production map service

## Boundary and ownership

The Next.js application in `apps/web` is an inspection client around the existing graph domain. Browser code owns MapLibre rendering, deterministic endpoint snapping, controls, and evidence presentation. Server-only adapter code owns artifact loading and typed translation between HTTP and `packages/graph`. The graph package remains the sole owner of Dijkstra, A*, legality, turn costs, and graph serialization.

The adapter reads the immutable pipeline 3 graph and its routing-support sidecar from ignored local paths. It rejects a sidecar whose graph hash differs. Route geometry is assembled from the ordered edge path, with every edge existence and topology join checked before coordinates are returned. Visual proximity and polyline intersections never create connectivity.

```mermaid
sequenceDiagram
  participant U as Local user
  participant W as Next browser
  participant A as Local route handler
  participant G as Graph package
  U->>W: Select map points or enter node IDs
  W->>W: Snap within 150 m to eligible endpoint; tie by node ID
  W->>A: POST route request
  A->>G: Dijkstra or A* on immutable index
  G-->>A: Ordered edge path and diagnostics
  A->>A: Check unresolved restrictions and boundary risk
  alt affected unsupported semantics
    A-->>W: 422 with relation IDs; no geometry
  else supported candidate
    A->>A: Verify and assemble ordered edge geometry
    A-->>W: Route evidence and qualified geometry
  end
```

## Local handlers

- `GET /api/network?mode=…` returns eligible directed edge GeoJSON, boundary-buffered endpoint candidates, graph identity, attribution, and one deterministic supported reference pair.
- `POST /api/route` accepts explicit node IDs, mode, and algorithm. It returns `found`, `unreachable`, `unsupported`, or `error`.

Both handlers set private/no-store behavior where applicable, validate bounded input, and are accepted only for loopback hostnames by default. Binding to loopback is the primary runtime boundary; Host validation is defense in depth, not authentication. `VECTORSHIFT_ALLOW_NONLOCAL=1` is an explicit development escape hatch and must not be used to publish this API.

## Selection and route qualification

Endpoint candidates come from the largest mode-eligible strong component and must be more than 100 m inside the declared acquisition bounds. A click snaps to the nearest candidate within 150 m using Haversine distance; exact distance ties resolve by stable node ID. The form exposes node IDs for keyboard operation. The interface says explicitly that nearest-node selection does not establish legal access.

An unsupported restriction concern is matched against the candidate's ordered source-way transitions. A match withholds the route rather than assuming permission. A boundary-sensitive path is shown only with a warning. This is conservative but incomplete: Phase 1C does not search for an alternative path that avoids a concern, evaluate conditional expressions, or prove the buffered route is globally complete.

## Rendering and data delivery

MapLibre renders actual eligible edge geometry and ordered route geometry. The default blank style works without a tile provider. An optional vector style URL and its attribution are environment configuration; public tile services are not assumed to provide unlimited or production-safe usage. The 1.29 MB local network response is acceptable for this bounded validation tool but is not the planned city-scale delivery format. ADR 0002's versioned PMTiles direction remains unchanged.

The UI uses charcoal/slate surfaces, one blue interaction accent, amber/red only for warning/error, compact aligned controls, live status text, focus-visible treatment, reduced motion, and non-map route evidence. It does not claim traffic observations, prediction, simulation, or navigation advice.

Phase 1D adds an optional OpenFreeMap Liberty development style, whose street labels, road hierarchy, buildings, water, parks, and land-use provide context. `NEXT_PUBLIC_BASEMAP_STYLE_URL` and explicit attribution configure the provider. OpenFreeMap is an as-is public service whose terms may change; its October 14, 2026 terms permit ordinary integration but specify bounds for offline download. It is a development candidate, not an accepted production tile SLA. A self-hosted/versioned PMTiles delivery review remains required before public launch.

Map style lifecycle is independent from graph lifecycle. Style and map load events reinstall versioned overlay sources; provider failure switches to the blank style. The graph, route, and selection sources survive conceptually through this reinstall and never derive connectivity from basemap geometry.

## Worldwide exploration and 3D

OpenFreeMap Liberty is the keyless development default, so a fresh local session can pan, zoom, rotate, and pitch across worldwide context. The city navigator provides deterministic camera presets for World, Toronto, Welland, and Niagara Falls; arbitrary navigation remains available through normal MapLibre controls. `NEXT_PUBLIC_BASEMAP_STYLE_URL=off` and provider failures both preserve the dark graph-only style.

Graph coverage is classified from a small explicit view registry, not from what the basemap happens to draw. The downtown Toronto bounds are `experimental` because their publication manifest is blocked. Welland, Niagara Falls, and all unregistered locations are `none`. The type model reserves `qualified`, but no region currently receives it. Clicking outside prepared graph coverage produces an explanation rather than a fabricated snap or route.

Terrain is an opt-in `raster-dem` visualization. Its source URL and attribution are public build configuration, and the source is reinstalled after every style load when the user has enabled it. It does not affect route weights or graph geometry. The building control only changes visibility of style-supplied `fill-extrusion` layers; a style without compatible height data reports the feature unavailable. Camera transitions use immediate jumps under reduced-motion preference.

Style replacement is an explicit tested lifecycle: retained graph, ordered-route, and selection view models are re-added after vector-to-blank, blank-to-vector, and failure-fallback transitions. Basemap, terrain, camera, and building state never mutate `packages/graph` or the local route service.

## Client concurrency and interaction invariants

- Every route request has an `AbortController` and monotonically increasing client generation. Only the current generation may update evidence, message, loading state, geometry, or camera.
- Endpoint edits and clear actions abort in-flight work and remove obsolete geometry. Swap recomputes the reversed real query when evidence already exists.
- Algorithm changes recompute immediately after a completed/in-flight query; mode changes wait for the new eligibility view before recomputing.
- Network requests use independent abort and generation guards so an older mode response cannot replace the active mode.
- Hover uses MapLibre feature state and changes React state only when the edge identity changes; it does not rerender the graph on every pointer event.
- Map event listeners, map workers, and in-flight requests are disposed on unmount.

The task rail focuses the map, opens routing evidence, or exposes layers. The inspector can collapse on desktop and becomes a bottom sheet on mobile. All map-only endpoint selection has an equivalent node-ID form and deterministic reference-pair action.

## Failure states and verification

Missing artifacts produce an explicit unavailable state. Invalid input is rejected. Unreachable paths show no geometry. Unsupported semantics return relation diagnostics. Browser tests cover the primary route workflow, swap/recompute, delayed stale-response rejection, basemap failure fallback, network failure, unsupported semantics, and automated WCAG A/AA checks. Unit tests cover snapping, geometry continuity/determinism, boundary qualification, and unsupported-path withholding. Reproducible desktop/mobile screenshots are produced by `npm run visual:web` into ignored `artifacts/phase1d`.
