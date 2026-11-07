# Phase 1C local routing-map benchmark

The machine-readable source is [`phase1c-web-api.json`](phase1c-web-api.json). On 2026-11-06, an Apple M4 running macOS ARM64 and Node 24.13.0 served the production Next build on loopback. Ten warmups preceded 200 sequential requests alternating Dijkstra and A* against one deterministic supported pair.

| Metric | Median | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HTTP round trip | 5.27 ms | 6.71 ms | 7.29 ms | 7.56 ms |
| Server route compute | 4.33 ms | 5.22 ms | 5.68 ms | 6.08 ms |

All 200 responses were `found`. The first network request after process start took 568.77 ms and returned 1,288,019 bytes. The production build emitted 22 JS/CSS files totalling 2,070,592 raw bytes or 588,691 bytes when each file was gzip-compressed.

This is a local loopback baseline on the bounded Toronto extract. It is not a network, concurrency, city-scale, end-user frame-time, or public-service benchmark. The emitted build total is not the exact browser transfer for the page. Headless functional tests were not repurposed as GPU responsiveness evidence.
