# Map context, terrain, and provider licensing

**Status:** worldwide development foundation; not a production provider approval

## Separation of coverage

VECTORSHIFT has two independent geographic concepts:

- **Map exploration coverage** is worldwide when the configured vector basemap is reachable. It supplies visual context only.
- **Computation coverage** exists only where a versioned graph and its qualification evidence have been prepared. The current downtown Toronto graph is `experimental` because its publication manifest is blocked. No current region is labeled `qualified`.

Basemap roads, labels, buildings, and apparent connections never enter snapping, routing, restriction evaluation, or simulation. A region without a graph remains explorable but cannot accept routing endpoints.

## Development vector basemap

The default development style is [OpenFreeMap Liberty](https://openfreemap.org/quick_start/), rendered by MapLibre. It provides worldwide OpenStreetMap-derived vector context, including street labels, water, parks, buildings, land use, and road hierarchy. Required visible credit is `OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors`.

The [OpenFreeMap terms](https://openfreemap.org/tos/) were reviewed on 2026-11-07 and were last updated 2026-10-14. The public service is provided as-is without an SLA and may change or stop. Its offline-download policy limits each download to 3,000 tiles or 50 MB, at most four parallel requests, and an identifying user agent. VECTORSHIFT does not implement bulk or offline basemap download in this phase.

`NEXT_PUBLIC_BASEMAP_STYLE_URL` is a public, build-time style URL override; `off` starts in graph-only mode. `NEXT_PUBLIC_BASEMAP_ATTRIBUTION` must match the selected provider and source licenses. Never put a secret token in either value. Before public hosting, accept a provider/self-hosting plan covering availability, privacy, request and egress budgets, cache/version behavior, attribution, style compatibility, and rollback. ADR 0002's versioned PMTiles direction remains the preferred owned-delivery candidate.

## Optional terrain DEM

Terrain is disabled unless `NEXT_PUBLIC_TERRAIN_TILES_URL` is configured. The documented development example is the Mapzen Terrain Tiles Terrarium endpoint in the [AWS Open Data Registry](https://registry.opendata.aws/terrain-tiles/). MapLibre decodes it as 256 px `terrarium` raster DEM tiles with a maximum source zoom of 15. The DEM affects visualization only; it does not provide road elevation, routing grade, flood depth, or simulation input.

Terrain Tiles combine datasets with different attribution requirements. Preserve the complete [Tilezen/Mapzen source attribution record](https://github.com/tilezen/joerd/blob/master/docs/attribution.md), including location-specific credit such as `Contains information licensed under the Open Government Licence – Canada` for Canadian data. `NEXT_PUBLIC_TERRAIN_ATTRIBUTION` is visible map credit, not a place for credentials.

The raw S3 endpoint is documented by Tilezen as intended for efficient EC2 access and is not a production CDN commitment. Public hosting therefore requires a separate capacity, caching, cost, privacy, source-version, and license review. Do not mirror or redistribute the composite until every included source obligation and storage policy is satisfied.

## Buildings and fallback

The 3D buildings control only toggles `fill-extrusion` layers already present in the configured style. It does not synthesize heights, assume a storey height, or convert unqualified footprint data. If the style has no compatible extrusion layer, the control reports that it is unavailable.

Every style load—provider, manual graph-only mode, retry, or failure fallback—reinstalls the authoritative graph, ordered route, and selection sources from retained application state. The dark empty style has no external dependency and remains the offline/failed-provider fallback.
