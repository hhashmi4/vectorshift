# Phase 1B Toronto routing baseline

**Measured:** 2026-11-06<br>
**Authoritative data:** [`phase1b-toronto-routing.json`](phase1b-toronto-routing.json)

## Workload and method

- Apple M4 MacBook, 10 logical CPUs, 16 GiB memory, macOS ARM64, Node `v24.13.0`; power mode and background load were not controlled.
- Pipeline 2 Toronto graph SHA-256 `c683b69428688f92e6729803b20e61b6c6305da756852c4c10dccb08966ad23f`: 7,863 nodes, 19,997 directed edges, 67 turn rules, 9,129,331 serialized bytes.
- 500 unique fixed-seed (`0x51f15e1d`) motor-vehicle endpoint pairs from the largest 1,830-node strongly connected component; 50 warmups per algorithm.
- Twenty cold samples construct a fresh index, then run Dijkstra and A*. Forced garbage collection is used where exposed for retained-memory readings and between repeated cold-index samples.
- The repository has no commit, so the raw report binds the graph source-tree digest instead.

## Observed results

| Metric | Dijkstra | A* |
| --- | ---: | ---: |
| Warm median | 1.265 ms | 0.785 ms |
| Warm p95 | 2.510 ms | 2.271 ms |
| Warm p99 | 2.660 ms | 2.669 ms |
| Warm maximum | 2.784 ms | 2.896 ms |
| Median states expanded | 1,632 | 903 |
| p95 states expanded | 3,252 | 2,654 |
| Median queue pushes | 1,714 | 964 |

All 500 queries agreed on reachability status and optimal cost. A* reduced mean states expanded from 1,650.448 to 1,098.452 for this workload; this is an observation, not a guaranteed speedup.

Fresh index construction had a 102.120 ms median and 103.184 ms p95 across 20 samples. The first Dijkstra query had 1.974 ms median / 4.779 ms p95; A* after that query had 1.713 ms median / 3.831 ms p95 and included lazy heuristic-bound initialization.

The retained index heap delta after forced GC was 11,434,688 bytes (10.90 MiB); retained RSS delta was 2,473,984 bytes (2.36 MiB). The harness sampled a 149,747,056-byte heap and 407,126,016-byte RSS peak while repeatedly constructing cold indexes. RSS deltas are especially allocator-sensitive; these process figures include the deserialized graph and V8 behavior and are not allocator-independent maxima.

## Interpretation and limits

This extract is far smaller than a city-scale production graph. Endpoints come from one connected motor-vehicle component, not observed demand. One run on one laptop cannot establish an SLO, cross-platform reproducibility, or capacity. The provisional regression budgets in [performance documentation](../../../docs/engineering/performance.md) intentionally include headroom and require later recalibration.
