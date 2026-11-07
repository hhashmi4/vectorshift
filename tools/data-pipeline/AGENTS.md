# Data-pipeline-specific instructions

These rules extend the root [AGENTS.md](../../AGENTS.md).

- Every acquisition pins source, query/extract identity, time, bounds, byte cap, license, attribution, and content hash. Network access is deliberate and never part of ordinary tests.
- Treat raw and derived OSM databases as ODbL data, separate from repository Apache-2.0 code. Do not mix proprietary provider data without explicit license review.
- Raw/derived assets remain ignored. Commit only small reviewed manifests, queries, schemas, fixtures with valid redistribution rights, and benchmark summaries.
- Verify source digest before transformation. Write through a temporary path and refuse to overwrite a published or non-matching artifact.
- A change to filtering, segmentation, IDs, direction/access mapping, length/cost calculation, or serialization increments the pipeline/dataset version and updates documentation/tests.
- Report skipped/unsupported tags and restrictions; never silently imply legal or routing completeness.
