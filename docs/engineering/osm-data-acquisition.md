# OpenStreetMap acquisition and licensing

**Status:** Phase 1C reference acquisition and transformation record<br>
**Legal note:** engineering guidance, not legal advice

## Reference area

The first bounded reference area is a small downtown Toronto rectangle in WGS 84 / EPSG:4326:

| Bound | Decimal degrees | E7 integer |
| --- | ---: | ---: |
| South | 43.6426000 | 436426000 |
| West | -79.3905000 | -793905000 |
| North | 43.6538000 | 436538000 |
| East | -79.3705000 | -793705000 |

Overpass bounding boxes use `(south, west, north, east)`. Ways crossing the rectangle may bring referenced nodes just outside it; the bounds describe the acquisition filter, not a clipping guarantee.

## Acquisition contract

The committed query [`toronto-downtown-roads.overpassql`](../../tools/data-pipeline/queries/toronto-downtown-roads.overpassql) requests highway ways and OSM restriction relations at the pinned database timestamp `2026-11-05T00:00:00Z`, then retrieves their referenced members. The committed configuration uses the documented global, attic-enabled Private.coffee community instance after the main instance returned HTTP 502 during this acquisition, and caps the response at 25 MiB. The endpoint is provenance, not semantic identity: query, snapshot, and returned bytes remain independently hashed. The acquisition script:

1. uses HTTPS POST against the configured Overpass interpreter;
2. sends the exact committed query and a project-specific user agent;
3. streams bytes to an ignored temporary file while enforcing the cap and calculating SHA-256;
4. atomically promotes the completed raw JSON under `data/raw`;
5. prints a manifest with endpoint, acquisition time, snapshot time, bounds, query hash, content hash, byte count, license, attribution, and pipeline version.

The historical `[date:...]` query makes the logical OSM database state reproducible on an Overpass instance with attic data. Raw JSON byte layout can still differ across server/software versions, so the exact acquired bytes and their SHA-256 are the reproducibility anchor. Overpass documents the historical date selector and bounding-box ordering in its [attic-data](https://wiki.openstreetmap.org/wiki/Overpass_API/versions#Attic_data) and [language](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide#Bounding_box_clauses_(%22bbox_query%22,_%22bounding_box_filter%22)) references.

No raw OSM response or generated graph is committed. A small metadata manifest may be committed after acquisition. Re-running acquisition requires deliberate network access; ordinary tests never contact Overpass.

## Recorded Phase 1A acquisition

The committed [Toronto acquisition manifest](../../data/manifests/toronto-downtown-2026-11-05.json) records the successful 2026-11-06 acquisition:

- exact raw response: 1,811,425 bytes, SHA-256 `d11b99c6b509c2a3fd8f431a50b090207559dcc1245d6bf4e7c1445d8738af7a`;
- query SHA-256: `b2020266492b221188e7cd0fd8810cd4ee16c3ba25a1b1aecc44193c27bdd046`;
- source elements: 8,197 nodes, 3,840 ways, and 133 relations;
- canonical derived graph: 7,969 nodes, 18,359 directed edges, 19 weak components, SHA-256 `568ac48e30edfb27f21d3f0a92c9492c3c27623c6bc5b4b837cf01e38035b89e`;
- imported turn rules: zero; all 133 source restriction relations remain an explicit Phase 1B gap.

The raw and derived files are ignored. The manifest is sufficient to verify supplied bytes, not to guarantee that a free community endpoint will remain available indefinitely.

## Recorded Phase 1B transformation

Phase 1B reuses the identical raw bytes and publishes a distinct pipeline/schema version in the [pipeline 2 manifest](../../data/manifests/toronto-downtown-2026-11-05-pipeline2.json). It produces 7,863 nodes, 19,997 directed edges, 67 turn rules, 16 weak components, and graph SHA-256 `c683b69428688f92e6729803b20e61b6c6305da756852c4c10dccb08966ad23f`. The changed node/edge counts reflect conservative access filtering and separate mode/direction groups; this is a new immutable dataset, not an in-place correction of pipeline 1.

All 133 returned relations are `type=restriction`; the count is not a proxy for supported rules. The mutually exclusive audit is:

| Outcome | Relations | Effect |
| --- | ---: | --- |
| Imported unconditional generic via-node subset | 56 | 67 mode-scoped forbidden transitions |
| Conditional restriction | 39 | rejected |
| Mode-specific restriction | 2 | rejected |
| `except=*` semantics | 23 | rejected |
| Via-way restriction | 2 | rejected |
| Unresolved way/direction/access | 11 | rejected |

The 11 unresolved relations are IDs `15056`, `138760`, `2963778`, `5265915`, `5265916`, `5312256`, `5312257`, `5828243`, `9499940`, `9510140`, and `18526296`. In each case the compiler could not find both a permitted incoming and outgoing directed member in the retained graph. It does not invent a member, reverse a one-way edge, or silently permit the turn.

## Recorded Phase 1C transformation

[Pipeline 3](../../data/manifests/toronto-downtown-2026-11-05-pipeline3.json) reuses the exact 1,811,425 source bytes and schema version 2. It publishes 7,871 nodes, 20,025 directed edges, 82 turn rules, and 16 all-mode weak components with graph SHA-256 `c12c4523e0b43725d6ad843816593395b6a0e780408c8009dc928756105c6573`. The graph artifact is 9,148,994 bytes. Its required 56,706-byte routing-support sidecar has SHA-256 `a4b8c49ec359cad6b70e947b012e6e01f8d0b984b2d066f734c61666fe362eae`.

| Outcome | Relations | Graph/support effect |
| --- | ---: | --- |
| Imported unconditional generic via-node | 56 | compiled |
| Partially imported exception | 12 | unambiguous bicycle rules compiled; motor ambiguity retained |
| Conditional without evaluation context | 39 | concern for bicycle and motor vehicle |
| Unsupported mode-specific value | 2 | bicycle `two_stage_turn_box` concern |
| Exception with no unambiguous supported mode | 11 | motor-vehicle concern |
| Via-way sequence | 2 | bicycle and motor-vehicle concern |
| Unresolved source transition | 11 | bicycle and motor-vehicle concern |

There are 77 relation concerns in total: 39 conditional, 23 motor exception ambiguities, 2 bicycle mode-specific values, 2 via-way sequences, and 11 unresolved transitions. A concern can affect two supported modes, so mode/category counts are not relation counts. Generated turn-rule IDs are recorded per source relation; duplicated semantic transitions retain references to the existing derived rule.

The explicit U-turn policy is `source_rules_only`: an edge transition is allowed unless the graph contains a matching source-derived ban. This is deterministic but not a substitute for jurisdictional law. Conditional restrictions are not evaluated because no date, time zone, vehicle class, weather, or other conditional context exists in Phase 1C.

## Boundary audit and halo procedure

All 594 nodes outside the acquisition rectangle share a retained way with at least one inside node. None are unexplained by Overpass member expansion. The farthest excursions are approximately 235 m west, 226 m east, 280 m south, and 370 m north; the graph includes 501 crossing and 833 outside-only directed edges.

In 500 fixed-seed motor-vehicle samples across the largest strong component, 297 paths were boundary-sensitive. Restricting endpoints to nodes more than 100 m inside the box reduced that to 65 of 500; this is risk reduction, not a completeness proof. Full results are in the [boundary audit](../../tools/benchmarks/results/phase1c-toronto-boundary.json).

A bounded [500 m halo query](../../tools/data-pipeline/queries/toronto-downtown-roads-halo-500m.overpassql) and [acquisition configuration](../../tools/data-pipeline/config/toronto-downtown-halo-500m.json) are prepared for `(43.638108, -79.396710, 43.658292, -79.364290)`, pinned to the same database date and 25 MiB response cap. Two attempts against the recorded community endpoint on 2026-11-06 reached the 120-second client timeout and produced no artifact. It has therefore not been acquired, and no halo comparison or improved completeness claim is made. A successful acquisition requires a separate content-addressed manifest and may not overwrite the existing reference bytes.

## Source and obligations

- **Source:** OpenStreetMap contributors through an Overpass API instance.
- **Database license:** Open Data Commons Open Database License 1.0 (ODbL).
- **Required attribution:** `© OpenStreetMap contributors`, linked to <https://www.openstreetmap.org/copyright> where links are supported.
- **Derivative database:** a transformed routable graph derived from OSM is treated conservatively as ODbL-covered when publicly distributed. Publication must provide attribution, identify the ODbL, and make the covered database or a means of creating it available as required.
- **Produced works:** maps/results still require attribution and a route to the applicable license/source obligations.

OpenStreetMap states that its data is ODbL-licensed, requires contributor credit and license notice, and requires adapted/distributed database data to remain under the same license. The OSMF FAQ distinguishes Produced Works, Derivative Databases, and Collective Databases and should be reviewed before mixing layers or publishing outputs: <https://www.openstreetmap.org/copyright> and <https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ>.

The repository's Apache-2.0 license applies to VECTORSHIFT code and original documentation, not to imported OSM data or OSM-derived databases. Do not combine proprietary map-provider geometry, traffic, or inferred attributes into the OSM-derived graph without a written compatibility review that addresses database-right and redistribution terms.

## Transformation pipeline

Pipeline `osm-road-graph/1` is retained as the Phase 1A historical transform. Pipeline `osm-road-graph/2` performs the original restriction-aware transformation. Pipeline `osm-road-graph/3` additionally:

- parses bounded Overpass JSON;
- retains ways with a `highway` tag and at least two resolvable nodes;
- splits ways into consecutive directed segment records;
- interprets generic and supported mode-specific one-way values, with generic vehicle direction separated from pedestrian direction and implicit vehicle direction for roundabouts/motorways;
- maps a limited highway hierarchy and conservative default modes;
- applies general access as a narrowing of hierarchy defaults and explicit per-mode overrides afterward;
- compiles unambiguous supported-mode parts of `except=*` and supported `restriction:<mode>` via-node rules;
- emits a deterministic graph-bound support sidecar for all remaining concerns and source-to-rule traceability;
- calculates geometry length using the documented `haversine-v1-node24` calculation and rounds once to millimetres;
- derives a default free-flow time from a limited parsed/default speed table;
- validates and serializes the graph canonically.

The manifest binds query, raw response hash, graph schema, pipeline version, and runtime. Any mapping, segmentation, access, length, speed, ID, or serialization change requires a new pipeline version and dataset version.

## Known data-quality and correctness limits

- OSM is community-maintained and may be incomplete, stale, incorrectly tagged, or geometrically imprecise.
- Conditional and via-way turn restrictions, ambiguous transit exceptions, unsupported mode-specific values, time-dependent access, vehicle-dimension, lane-level, construction, reversible, and jurisdiction-specific access remain unsupported and are rejected or qualified as documented.
- Basic mode defaults and the denied-value set are not a complete legal-access engine. Absence of an OSM tag is not proof of legal access.
- Grade separation depends on OSM topology and tags; geometric crossings never create graph connections.
- The initial length calculation is reproducible within the pinned Node 24/pipeline contract, but is not a survey measurement.
- The acquisition rectangle is not a routable city boundary and creates artificial edge effects.

Before any public real-world routing claim, unresolved restriction/access cases require source-level review, via-way and conditional semantics require implementation or product exclusion, the bounded halo experiment must be compared, and selected paths must be checked against current OSM/legal evidence. Phase 1C routes are qualified engineering demonstrations over a pinned extract, not travel guidance.
