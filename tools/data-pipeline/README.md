# Data pipeline boundary

This directory will contain reproducible acquisition, normalization, validation, and publication tools for licensed OSM-derived graph and PMTiles releases. Each release must produce source/license/attribution metadata, pipeline/config versions, validation results, and checksums.

Pipelines write large inputs and outputs only to ignored local or configured object storage locations. They must not download data during ordinary unit tests or silently republish an existing immutable version.

Phase 1A provides a bounded, pinned downtown Toronto Overpass acquisition and a deterministic import adapter:

```sh
node tools/data-pipeline/scripts/acquire-osm.mjs
node tools/data-pipeline/scripts/import-osm.ts
```

The acquisition command performs a network request and is deliberately separate from tests. It enforces a 25 MiB response cap. The import command verifies the committed source digest before parsing and writes the canonical graph under ignored `data/derived`. See [acquisition and licensing](../../docs/engineering/osm-data-acquisition.md).
