# Routing architecture and correctness contract

**Status:** Implemented through Phase 1C for graph schema version 2 and routing-support artifact version 1<br>
**Scope:** static shortest paths over one immutable graph and one travel mode

## Public contract

`RoutingIndex` validates and copies the graph's routing fields into an immutable in-memory index. A query names an existing start node, destination node, and one of `motor_vehicle`, `bicycle`, or `pedestrian`. The result is a typed `found` or `unreachable` value containing ordered edge and node paths, integer millisecond cost, graph/dataset/algorithm provenance, and search diagnostics. Invalid node IDs or modes raise typed input errors. Routing never mutates the graph.

The cost model is the sum of each permitted edge's `traversal_time_ms_by_mode` plus applicable positive turn penalties. Forbidden transitions are absent from the search. All costs are non-negative safe integers. Start-equals-destination returns an empty path with cost zero. U-turns are permitted unless an explicit source turn rule forbids the transition (`source_rules_only`); this is a reproducible engineering policy, not a claim about untagged jurisdictional law. Geographic snapping never creates connectivity.

## Edge-state search

Search state is the incoming directed edge. The current topological node is that edge's target. This is necessary because two paths arriving at the same node can have different legal next transitions. The initial state has no incoming edge, so turn rules do not apply before the first traversal.

The index stores edges and each node's outgoing edge indexes in stable edge-ID order. A sparse lookup keyed by incoming edge, outgoing edge, and mode returns a forbidden decision or penalty. Parallel edges are distinct states. Equal-cost relaxations do not replace an existing predecessor; the priority queue orders by estimated total cost, settled cost, then edge ID, making a fixed graph/query/runtime deterministic.

## Algorithms

### Dijkstra

Dijkstra is the correctness reference. With `V_e` eligible incoming-edge states and `T_e` legal transitions, binary-heap time is `O((V_e + T_e) log V_e)` and working memory is `O(V_e)`, excluding the shared index. It supports zero-cost edges; strict-improvement relaxation prevents zero-cost cycles from causing repeated equal-cost updates.

### A*

A* uses identical state, mode, turn, and cost rules. Its heuristic is straight-line endpoint distance divided by a conservative maximum straight-line speed observed across all edges eligible for the query mode. The bound uses topological node coordinates, never rendering polyline connectivity. Because the maximum bounds every edge's endpoint displacement per millisecond and turn penalties are non-negative, the heuristic is admissible and consistent under the current cost model.

If any eligible edge has positive endpoint distance and zero cost, or no positive bound can be established, A* uses a zero heuristic and becomes Dijkstra-equivalent. This fallback is exercised by the synthetic corpus. A future scenario cost model must establish its own bound; it may not reuse this heuristic by assumption.

## Implemented access and restriction semantics

- Generic OSM `oneway` affects motor vehicles and bicycles, not pedestrians. `oneway:bicycle`, `oneway:foot`, and motor-vehicle-specific overrides are handled; roundabouts and motorways have the documented implicit vehicle direction unless explicitly overridden.
- `access`, `vehicle`, `motor_vehicle`/`motorcar`, `bicycle`, and `foot` values in the conservative denied set (`no`, `private`, `customers`, `delivery`, `destination`, `permit`) remove the affected supported mode. General access only narrows the highway defaults; an explicit mode tag can re-enable or disable that mode. Conditional access is warned and not evaluated.
- Unconditional generic via-node `no_left_turn`, `no_right_turn`, `no_straight_on`, `no_u_turn`, and the corresponding `only_*` values compile for motor vehicles and bicycles where both directed members resolve.
- `only_*` compiles to forbidden transitions from the incoming member to every other currently traversable outgoing edge at the via node.
- A supported `except=bicycle` removes the bicycle restriction. Exceptions such as `bus` or `psv` cannot be represented by the aggregate `motor_vehicle` mode, so the unambiguous bicycle part is compiled while the motor-vehicle ambiguity remains an explicit concern.
- Direct supported `restriction:bicycle` values compile for bicycle. Toronto's two `restriction:bicycle=two_stage_turn_box` relations are not turn bans and remain unsupported.

Conditional restrictions have no Phase 1C date/time/vehicle evaluation context and remain unsupported. Via-way sequences, ambiguous transit exceptions inside `motor_vehicle`, unknown mode-specific values, incomplete member shapes, and transitions unresolved after access/direction filtering also remain unsupported. Lane, dimension, reversible-lane, traffic-signal delay, jurisdictional default, and live-condition semantics are absent.

Every source relation records its generated rule IDs. A deterministic routing-support artifact binds the graph/source hashes, full audit, unresolved relation members, affected supported modes, exception values, and explicit U-turn policy. After a candidate path is found, the local adapter checks its ordered source-way transitions against these concerns. An affected path is returned as `unsupported` with relation IDs; it is never displayed as legal. This path-specific check does not prove that an alternative unaffected legal path does not exist.

## Boundary qualification and local adapter

The Phase 1C local adapter selects endpoints from a mode-eligible strong component and applies a 100 m acquisition-boundary buffer. A returned path that leaves the declared bounds or reaches that buffer is labeled `boundary_sensitive`. A path staying in the core is only qualified as lower-risk; it is not proof that omitted roads cannot change the optimum.

The adapter resides in `apps/web` server-only code. It loads and verifies the immutable graph and support sidecar, calls this package's Dijkstra/A*, assembles display geometry from the ordered edge path, verifies edge continuity, and exposes only loopback route handlers by default. Browser code receives eligible geometry and typed route evidence; it does not contain a routing implementation or the raw Overpass source.

## Correctness evidence

The committed hand-audited corpus independently specifies expected paths and costs for a restricted turn, penalty, one-way, disconnected component, parallel edges, zero-cost edge, equal-cost alternatives, start-equals-destination, and mode restriction. A separate legality checker recalculates continuity, mode access, turns, penalties, and cost.

Eighty fixed-seed small graphs compare both algorithms to an independent repeated-relaxation Bellman–Ford edge-state oracle. A metamorphic test verifies that increasing an edge cost cannot improve the optimal cost under unchanged constraints. The Toronto benchmark checks status and optimal-cost agreement for 500 fixed-seed queries; it is evidence for this extract, not a universal proof.

## Non-goals and limitations

There is no scenario overlay, dynamic cost update, contraction hierarchy, multi-criteria route, alternative-path search around an unsupported concern, transit model, lane model, or full legal-access engine. Snapping is deterministic proximity to an already eligible node and is not a legal-access decision. The graph's default free-flow times are synthetic routing weights, not traffic observations or predictions. Boundary truncation and unsupported OSM semantics can make a technically valid path unsuitable for real-world travel.
