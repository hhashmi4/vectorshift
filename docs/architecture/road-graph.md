# Road graph contract

**Status:** Accepted through Phase 1C schema version 2<br>
**Scope:** road topology, traversal attributes, turns, serialization, provenance, analysis, and routing compatibility

## Representation decision

VECTORSHIFT stores a **directed primal graph** and uses **edge-based routing state**.

- A topological node is a legal junction or shape point with a stable, version-scoped internal ID and an EPSG:4326 coordinate.
- A directed edge is one permitted traversal from a source node to a target node. Bidirectional road segments become two independently addressable directed edges. Parallel edges are valid.
- A turn rule relates an incoming directed edge to an outgoing directed edge at a shared via node. It may forbid the transition or add a non-negative penalty.
- Routing state in Phase 1B will include the previously traversed edge, because legality and cost can depend on the edge-to-edge transition rather than only the current node.

This is a hybrid rather than a fully edge-expanded stored graph: edges and a sparse turn table remain compact on disk; a router may construct edge-state adjacency or an expanded view in memory. The representation avoids duplicating every legal turn in the serialized dataset while retaining the semantics needed for turn-aware routing.

### Why node-only routing is insufficient

Node-based state is smaller and works for costs that depend only on the next edge. It cannot distinguish arriving at the same junction from different approaches without placing path history outside the state. That makes turn bans, U-turn policy, and approach-dependent penalties awkward and error-prone. Edge-based state represents those rules directly, at the cost of more routing states and potentially more transitions. The compact graph therefore stores primal nodes/edges, while the routing algorithm uses the directed incoming edge as state.

Phase 1C retains the bounded via-node model and adds unambiguous supported-mode compilation for exception and mode-specific tags. Ambiguous or unsupported semantics remain in a graph-bound routing-support sidecar with source member traceability. The graph schema does not pretend to encode temporal contexts or via-way automata; those require a future versioned contract.

## Topology versus rendering geometry

Topology is determined exclusively by node identities and edge `source_node_id`/`target_node_id`. Geographic proximity, crossing polylines, or coincident coordinates never create connectivity implicitly.

Rendering geometry is the ordered EPSG:4326 polyline attached to an edge. It must begin and end at the referenced node coordinates, but intermediate points are visual/metric shape information, not junctions. A bridge crossing another road in geometry is disconnected unless the topology shares a node. A renderer may simplify geometry under a separately versioned mapping pipeline; it must not change graph connectivity.

## Coordinate and unit policy

- CRS is fixed to `EPSG:4326` for schema version 2.
- Axis order in serialized coordinates is longitude, latitude.
- Coordinates are signed integers in degrees multiplied by `10,000,000` (`E7`), avoiding locale and decimal serialization ambiguity.
- Length is a positive integer in millimetres. Per-mode free-flow traversal times are non-negative integer milliseconds, permitting synthetic zero-cost edges; turn penalties remain positive integer milliseconds. Every permitted mode has exactly one traversal-time entry.
- Import adapters may calculate length from source geometry, but the algorithm and runtime are part of the transformation pipeline version. The canonical graph contains the resulting integer, not an implicit recalculation.

## Stable identifiers

Internal identifiers are stable for the same source object segmentation and pipeline major version, but only within a graph dataset/version:

- Node: `node:<namespace>:<source-node-id>`
- Directed edge: `edge:<namespace>:<source-segment-id>:forward|reverse`
- Turn rule: caller-provided stable ID derived from the source restriction or a synthetic fixture recipe

An OSM way is split between consecutive referenced nodes. Its source segment ID includes the way ID and zero-based pair index, so parallel ways and repeated endpoints remain distinct. A pipeline change that alters segmentation or ID construction publishes a new dataset version; cross-version identity is not inferred.

## Schema summary

The current machine-readable schema is [`road-graph-v2.schema.json`](../../packages/contracts/schemas/road-graph-v2.schema.json). Version 1 remains preserved for interpreting prior immutable artifacts. The canonical document contains:

- format and schema version;
- immutable dataset identity and detailed source/provenance manifest;
- CRS and coordinate scale;
- topological nodes;
- directed edges with hierarchy, modes, metrics, source segment, and geometry;
- sparse turn rules.

Road hierarchy is a controlled classification, not a promise of legal access. Schema version 2 supports `motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `service`, `living_street`, `path`, and `other`. Modes are `motor_vehicle`, `bicycle`, and `pedestrian`. Turn rules carry an explicit non-empty mode set. Import mappings are conservative and versioned.

## Deterministic serialization and integrity

The serializer validates, sorts nodes/edges/turns by ID, sorts and deduplicates mode arrays, recursively sorts object keys, emits UTF-8 JSON with one trailing newline, and computes SHA-256 over the canonical graph object. The artifact envelope carries that digest. Deserialization parses, validates, reserializes, and rejects a digest mismatch.

Arrays whose order has semantics—edge geometry—are never reordered. Unknown schema versions and unknown object properties are rejected. The canonical bytes, digest, schema version, dataset version, pipeline version, source hash, and source license together form the publication identity.

## Validation invariants

- IDs are non-empty, unique within kind, and use the stable restricted character set.
- Every edge endpoint exists; source and target differ for schema version 2.
- Edge geometry contains at least two distinct valid coordinates and matches endpoint coordinates.
- Length is a positive safe integer; every per-mode traversal time is a non-negative safe integer; cost keys exactly match permitted modes.
- Hierarchy and modes are known; modes are non-empty and unique.
- A turn references existing edges that join at the declared via node and declares one or more known modes. Graph analysis additionally reports a consistency issue if a restricted mode is not traversable on both edges.
- Forbidden turns have no penalty; penalized turns have a positive penalty.
- Dataset bounds, source hash, CRS, license, attribution, and pipeline version are valid and present.

Validation reports stable issue codes/paths in sorted order. It does not claim that OSM data is complete, current, legally routable for every mode, or geometrically survey-grade.

## Connectivity and statistics

The analysis module deterministically reports weak and strong topological components, isolated nodes, restriction-aware directed reachability, per-mode eligible/ineligible edges, component edge counts, and boundary diagnostics. Weak connectivity intentionally ignores edge direction; component decomposition also ignores turn-transition rules, while `isReachable` honors forbidden mode-scoped transitions. Mode-filtered analysis retains all published nodes, so nodes with no eligible edge are intentionally reported as isolated; consumers selecting routing endpoints should use an eligible strongly connected component and still run a legal route query.

## Compatibility

Readers reject unsupported major schema/format versions. Additive fields still require a schema version because canonical bytes and unknown-field behavior are strict. Published artifacts are immutable. A migration reads an older artifact and publishes a new version/digest; it never changes bytes behind an existing identifier.

The Phase 1C pipeline 3 graph remains schema version 2 because the core graph contract did not change. Its separately versioned routing-support artifact is required by consumers that present routes from the Toronto reference. A graph hash mismatch between the two fails loading. Consumers must not discard the sidecar and silently treat unresolved source semantics as permitted travel.
