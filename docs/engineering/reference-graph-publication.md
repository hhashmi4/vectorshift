# Reference graph publication candidate

**Status:** Blocked publication candidate; safe for qualified local engineering use

## Candidate identity

The Phase 1D candidate is `osm-2026-11-05-halo500-pipeline3`, derived from OpenStreetMap at the fixed timestamp `2026-11-05T00:00:00Z`. The machine-readable [publication manifest](../../data/manifests/reference-graph-publication-candidate-v1.json) binds source provenance, ODbL attribution, acquisition bounds, graph schema, transformation and restriction-support versions, supported modes, canonical and file hashes, measured comparison evidence, and limitations.

The candidate is immutable. It does not replace the Phase 1C baseline. Raw OSM responses and derived graph artifacts remain ignored and ODbL-covered; the Apache-2.0 repository license does not relicense them.

## Bounded, resumable acquisition

The original combined 500 m halo request repeatedly reached its 120-second client timeout. A highway-only quadrant also timed out on the original community endpoint, establishing that response size alone was not the problem. Historical attic lookup, recursive member expansion, endpoint load, and the original query's conflation of output-byte and server-memory limits were material confounders.

The replacement [partition plan](../../tools/data-pipeline/config/toronto-downtown-halo-500m-partitions.json) uses:

- four highway quadrants and twelve smaller restriction cells;
- one fixed historical timestamp and exact geographic union;
- sequential requests only;
- 2 MiB per response and 32 MiB aggregate hard caps;
- up to three bounded retries for transient 429/502/503/504 or timeouts;
- atomic part files, query and content SHA-256 values, and restart verification;
- deterministic type/ID merge that accepts skeletal/full strict supersets but rejects any two present source fields that disagree.

The responsive global attic-enabled endpoint produced 3,102,727 canonical merged bytes from 20,771 nodes, 7,529 ways, and 284 restriction relations. Several transient 504s were recovered by the bounded resume policy. The exact part hashes are recorded in the [acquisition manifest](../../data/manifests/toronto-downtown-halo-500m-2026-11-05.json).

## Reproduction procedure

No network request is part of ordinary reproduction. Obtain the ignored raw merged response whose SHA-256 is `449e225938f87a5286f19ca452ff108fa8531f2edc27d7c1d963cf12205f3404`, place it at the manifest path, then run:

```sh
npm ci --ignore-scripts
node tools/data-pipeline/scripts/import-osm.ts data/manifests/toronto-downtown-halo-500m-2026-11-05.json
shasum -a 256 data/derived/osm-2026-11-05-halo500-pipeline3.road-graph.json
shasum -a 256 data/derived/osm-2026-11-05-halo500-pipeline3.routing-support.json
```

Expected canonical graph SHA-256 is `cdca4ca0f75ef08fc34fc33ded8b41659e4398c87f399e29a80f94201f7c6f5a`; the serialized graph file SHA-256 is `0d46f8c7e0cbe0b3db61bb0b1bd2c41235a269220bf0b44f1a2c2e861d2388aa`; the support artifact SHA-256 is `660ef7be9135ece298666d3179cc7bacad2a66272c632e2b8abdb4e5547c08b4`.

An isolated temporary install on the same Apple M4 reproduced both derived hashes. This is not second-machine evidence.

## Comparison evidence

The 500 fixed-seed queries used endpoints in the baseline's largest motor-vehicle strong component, common to both graphs and more than 100 m inside the baseline bounds.

| Measure | Baseline | Halo candidate |
| --- | ---: | ---: |
| Nodes | 7,871 | 19,798 |
| Directed edges | 20,025 | 50,065 |
| Turn rules | 82 | 177 |
| Weak components, all modes | 16 | 27 |
| Largest motor strong component | 1,830 | 5,301 |
| Graph artifact | 9.15 MB | 22.99 MB |
| Warm Dijkstra median | 1.21 ms | 2.00 ms |
| Warm Dijkstra p95 | 2.53 ms | 5.99 ms |
| Isolated retained RSS delta | 255.1 MB | 422.8 MB |
| Isolated retained heap delta | 26.5 MB | 66.4 MB |

All 500 pairs remained reachable. Four hundred ninety-two retained identical cost and edge path; eight found a lower-cost path in the halo and require independent inspection. Baseline boundary qualification marked 76 routes sensitive; the halo marked zero for these core pairs. Unsupported restriction qualification changed from 183 to 184 paths because the halo includes additional source relations.

The manually observed Phase 1C query remained exactly 532,856 mm, 68,031 ms, and 30 edges. A* expanded 906 baseline states and 965 halo states. Dijkstra and A* agreed in both graphs.

## Publication blockers

- Eight changed fixed-seed paths have not received independent source-level route review.
- The candidate has 147 concerns: 87 conditional, 14 via-way, 13 unsupported-exception, 4 mode-specific, 14 unresolved transition concerns, plus partial semantics recorded by the audit.
- Via-way sequences are detected after candidate routing but not encoded in search state, so the engine cannot find a supported alternative automatically.
- Conditional restrictions lack a date/time/vehicle evaluation context and remain deliberately unevaluated.
- Aggregate `motor_vehicle` cannot distinguish bus, PSV, taxi, and similar exception classes.
- A 500 m halo reduces but cannot prove removal of boundary distortion.
- No second supported machine has reproduced the candidate.

The publication verdict is **not ready**. The candidate may be used locally only with the existing restriction and boundary qualification diagnostics.
