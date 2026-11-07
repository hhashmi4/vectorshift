# ADR 0002: MapLibre GL JS and versioned PMTiles

- **Status:** Accepted
- **Date:** 2026-11-06
- **Owners:** Mapping and frontend

## Context

The product needs a map-first, open-source-capable client with efficient immutable vector delivery and custom disruption overlays.

## Decision drivers

- Open ecosystem, vector styling, GPU rendering, range-request distribution, immutable caching, and attribution control.

## Considered alternatives

- Proprietary hosted SDKs offer managed data but add licensing/cost/platform coupling.
- Raster tiles simplify rendering but limit styling, inspection, and network detail.
- MapLibre plus conventional tile service works, but PMTiles reduces serving components for immutable releases.

## Decision

Use MapLibre GL JS for the map and versioned PMTiles objects for basemap/network delivery. Map release manifests bind PMTiles checksums, style compatibility, source license, and attribution. Use custom GPU layers or deck.gl only after measured MapLibre-layer limits and an accessibility/hit-testing design.

## Consequences

Static immutable distribution and CDN caching are simple. The team owns tile generation, range-request behavior, style compatibility, and fallback/error UX.

## Risks

Large archives, cache/range misconfiguration, browser/GPU variation, and overlay complexity can harm experience. Validate on representative devices and keep non-map access to essential data.

## Revisit triggers

Revisit if range access is unreliable, client memory cannot meet accepted targets, styling requirements exceed the engine, or licensing/attribution constraints change.

## Phase 1C implementation evidence

The local routing inspector uses MapLibre GL JS 6.16.0 with an explicit bundled worker URL, actual graph GeoJSON, keyboard-equivalent form controls, reduced-motion behavior, visible OSM attribution, and an optional environment-configured basemap. It deliberately does not introduce PMTiles before a versioned tile asset exists. Browser integration verifies route rendering, non-map evidence, error recovery, and automated WCAG A/AA checks; performance evidence remains limited to API/build measurements.

## Worldwide foundation evidence

The development client now defaults to the worldwide OpenFreeMap Liberty style, while preserving an explicit graph-only mode and failure fallback. Map exploration and graph coverage are separate state: the current Toronto graph is experimental, and other explored regions have no graph. Optional raster DEM terrain and style-supplied building extrusions are visualization-only and require source attribution; neither may influence graph topology or costs. Style reload tests verify that graph, route, and selection overlays are reinstalled. This evidence does not accept OpenFreeMap or the example DEM as a production SLA, and it does not replace the versioned PMTiles publication decision.
