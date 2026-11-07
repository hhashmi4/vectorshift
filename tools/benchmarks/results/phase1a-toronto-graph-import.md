# Phase 1A Toronto graph import baseline

**Measured:** 2026-11-06<br>
**Authoritative raw result:** [`phase1a-toronto-graph-import.json`](phase1a-toronto-graph-import.json)<br>
**Status:** engineering baseline, not an SLO or accepted regression threshold

## Question and workload

What are the JSON parse, validated OSM import, canonical serialization, end-to-end, and retained-memory baselines for the pinned Phase 1A downtown Toronto input?

- Command: `npm run benchmark:graph`
- Warmups: 3; measured repetitions: 10
- Input: 1,811,425 bytes, SHA-256 `d11b99c6b509c2a3fd8f431a50b090207559dcc1245d6bf4e7c1445d8738af7a`
- Graph: 7,969 nodes, 18,359 directed edges, 0 imported turn rules
- Graph SHA-256: `568ac48e30edfb27f21d3f0a92c9492c3c27623c6bc5b4b837cf01e38035b89e`
- Correctness: all ten run digests identical and equal to the committed manifest expectation

## Environment

Apple M4 MacBook, 10 logical CPUs, 16 GiB memory, macOS ARM64, Node.js 24.13.0. Power mode and background load were not controlled. The repository has no commit, so the raw report records a SHA-256 of the graph source files instead.

## Results

| Operation | Minimum | Median | p95 / maximum | Mean |
| --- | ---: | ---: | ---: | ---: |
| JSON parse | 3.31 ms | 3.38 ms | 3.50 ms | 3.40 ms |
| Validated import | 35.23 ms | 37.61 ms | 49.01 ms | 39.52 ms |
| Canonical serialization | 106.04 ms | 107.83 ms | 117.72 ms | 109.32 ms |
| End-to-end | 146.93 ms | 150.26 ms | 159.51 ms | 152.24 ms |

After forced garbage collection, retaining the parsed OSM document, graph, and serialized artifact increased V8 heap use by 19,607,160 bytes and RSS by 8,077,312 bytes in the measured process. This is a single retained-delta observation, not a peak-memory distribution.

## Interpretation and limits

This establishes a reproducible local baseline only. Ten samples on one uncontrolled laptop are insufficient for an SLO or regression threshold. V8 allocation and RSS are sensitive to garbage collection and prior process activity. The workload omits imported turn restrictions and does not represent a city-scale graph. The next useful experiment is a controlled Phase 1B routing benchmark after restriction/access correctness and a reference route corpus exist.
