# Performance and resource budgets

**Status:** Product targets remain hypotheses; the Phase 1B routing section records one measured engineering baseline, not an SLO.

Targets are evaluated on named reference devices, networks, graph sizes, demand profiles, engine builds, and concurrency. Each report includes median, p95/p99 where meaningful, sample count, warmup, variance, and raw artifacts. A target becomes accepted only after a benchmark ADR or reviewed baseline records evidence.

## Initial target hypotheses

| Area | Proposed target | Measurement boundary |
| --- | --- | --- |
| Browser interaction | p95 input-to-visible-response under 100 ms while panning/selecting; no task over 200 ms during steady interaction | Supported mid-tier laptop, representative dense viewport |
| Render cadence | At least 30 fps p95 during supported pan/zoom/overlay combinations; aspirational 60 fps | Frame timing, GPU/CPU/memory recorded |
| Scenario edit | p95 under 300 ms from accepted click to authoritative acknowledgement on a representative regional network | Excludes user network outliers; separately report edge/coordinator time |
| Simulation startup | p95 under 2 s from admission to first running/progress event when warm capacity exists | Cold capacity reported separately |
| Simulation throughput | At least 10 simulated minutes per wall-clock second for the first reference city/profile | Exact graph, trips, timestep, hardware, and model required |
| WebSocket freshness | p95 under 500 ms from coordinator event commit to visible client update | Excludes coalesced optional samples; never masks gaps |
| Client memory | Under 500 MiB steady-state and no growth over a 30-minute interaction soak | Browser process attribution documented |
| Worker memory | Under 2 GiB peak for the first bounded reference job | OOM produces explicit failure, never partial success |
| Initial map assets | First useful map under 2.5 s on a defined broadband profile; interaction transfer under 10 MiB | Cold cache and warm cache reported separately |
| Cost | Median variable infrastructure cost below USD 0.10 per first reference job | Region, pricing date, storage/egress/coordination/compute included |

These numbers are prioritization hypotheses, not promises. Reference profiles and cost accounting are unresolved until representative fixtures and deployment candidates exist.

## Phase 1B routing baseline and provisional budgets

The authoritative [machine-readable result](../../tools/benchmarks/results/phase1b-toronto-routing.json) and [reviewed summary](../../tools/benchmarks/results/phase1b-toronto-routing.md) measure 500 fixed-seed motor-vehicle queries within the largest strongly connected component of the 7,863-node pipeline 2 Toronto extract. This is not city-scale evidence.

Based on that single baseline, the next regression gate is provisionally: warm p95 below 5 ms for each algorithm, warm p99 below 7.5 ms, retained routing-index heap delta below 25 MiB, and exact Dijkstra/A* status-and-cost agreement. These thresholds are deliberately looser than the observed run and are test-environment budgets, not user-facing SLOs. They must be revisited after a second machine, a larger graph, repeated runs, controlled power state, and scenario overlays.

## Budget enforcement

Every public run class declares maximum graph size, trips, time horizon, step count, CPU time, wall time, memory, output bytes, event rate, and concurrent jobs. API requests declare maximum body and operation counts. The coordinator admits against per-access-grant and global concurrency budgets. Workers enforce hard limits independently. Output sampling and stream coalescing are deterministic where they affect result identity and opportunistic only for explicitly non-authoritative progress.

Backpressure proceeds from cheapest to most expensive: reject oversized inputs, rate-limit commands, cap active streams, bound coordinator mailboxes, delay/reject run admission, constrain dispatch, coalesce disposable progress, and terminate slow stream consumers with resumable status. No layer uses an unbounded in-memory queue.

## Phase 1C local web baseline

The [machine-readable Phase 1C result](../../tools/benchmarks/results/phase1c-web-api.json) measured a production Next build over loopback on an Apple M4 with Node 24.13.0. After ten warmups, 200 sequential requests alternating Dijkstra and A* against one supported deterministic pair had 5.27 ms median, 6.71 ms p95, and 7.29 ms p99 client round-trip latency. Reported server compute was 4.33 ms median, 5.22 ms p95, and 5.68 ms p99. All 200 returned `found`.

The first network request after starting the process took 568.77 ms and returned 1,288,019 bytes. All emitted static JS/CSS chunks totalled 2,070,592 raw bytes and 588,691 bytes when individually gzip-compressed. This is an emitted-build total, not a route-specific browser transfer size. No representative GPU/frame-timing result was recorded: a headless browser is useful for functional and accessibility checks but not a defensible map responsiveness benchmark.

These measurements are one local engineering baseline, not a public latency SLO or city-scale proof. The 1.29 MB network payload and all-static-chunk total are optimization candidates only after route correctness and representative transfer profiling are preserved.

## Benchmark protocol

1. Pin source commit, build flags, runtime, OS/architecture, hardware, power mode, dataset/graph/demand/model versions, seed, and command.
2. Separate correctness fixtures, microbenchmarks, end-to-end latency, soak, and cost experiments.
3. Record warmup and cache state; use multiple seeds only when the experiment asks a statistical question.
4. Store machine-readable raw output outside Git when large, plus a small reviewed summary and checksum/provenance.
5. Compare distributions and defined regression thresholds, not a single best run.
6. Treat surprising improvements as results to reproduce. Never replace missing measurements with estimates labeled as results.

The [performance skill](../../.agents/skills/performance-benchmarking/SKILL.md) is the execution checklist.

## Phase 1D web baseline

The machine-readable [API result](../../tools/benchmarks/results/phase1d-web-api.json) and [browser result](../../tools/benchmarks/results/phase1d-web-browser.json) use the Phase 1C baseline graph on an Apple M4, macOS ARM64, Node 24.13.0, and a production Next.js build over loopback.

After ten warmups, 200 sequential alternating Dijkstra/A* API requests all returned `found`: round trip was 4.59 ms median, 6.69 ms p95, and 8.04 ms p99; server compute was 3.70/5.18/6.80 ms. The cold-process network response was 1,288,019 bytes in 483.33 ms. All emitted static JS/CSS chunks totalled 2,092,738 raw bytes and 593,671 bytes when individually gzip-compressed; that is not per-route transfer.

Headless Chrome 156 at 1440×960 measured 30 real UI route interactions after graph readiness: 25.24 ms median, 30.18 ms p95, and 64.75 ms p99. The page recorded 2,016,767 resource-transfer bytes. Used JS heap after explicit GC grew by 3,807,423 bytes across the route workload and 20 scripted pan gestures; this is a directional signal, not renderer/GPU/RSS or leak proof. The Long Tasks observer recorded zero tasks over 50 ms, but headless timing is not an FPS or perceived-smoothness result. A representative-device GPU trace and longer soak remain open.

## Worldwide map foundation browser baseline

The generated [machine-readable result](../../tools/benchmarks/results/worldwide-map-foundation-browser.json) has SHA-256 `ec7e808912768886b170dce46107619a68843bdd323963b5ebaffb74e8efa04a`. It measures the production build with the worldwide development basemap enabled on the same Apple M4/macOS ARM64/Node 24.13.0 class of environment, using headless Chrome 156 at 1440×960 and reduced motion. The exact command was:

```sh
PLAYWRIGHT_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run benchmark:browser --workspace @vectorshift/web -- --output tools/benchmarks/results/worldwide-map-foundation-browser.json
```

Across 30 route interactions, median latency was 25.36 ms, p95 was 40.53 ms, and p99/maximum was 68.48 ms. Graph readiness was 901.94 ms. Twenty scripted pan gestures plus the route workload recorded no Long Tasks over 50 ms. Used JavaScript heap after explicit GC increased by 4,824,187 bytes; this is only a directional signal, not renderer, GPU, RSS, or leak evidence. The Resource Timing entries reported 47 resources and 2,019,236 transfer bytes, but cross-origin provider resources can report zero or incomplete transfer sizes without suitable timing headers.

This single headless local run supports continued development against the provisional 100 ms interaction hypothesis; it does not accept the target, establish FPS, measure terrain-enabled rendering, prove mobile performance, or replace physical-device GPU and long-soak testing. Basemap network/cache state and background load were uncontrolled, so the graph-readiness value is not directly comparable to the earlier graph-only baseline.
