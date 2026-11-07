# Local data policy

This directory documents local data conventions; it does not contain datasets.

Suggested ignored paths are `data/raw` for unmodified licensed downloads, `data/derived` for rebuildable graph/tile output, and `data/cache` for disposable intermediates. Each local dataset should have a sidecar manifest with source URL/provider, retrieval time, geographic scope, license/attribution, checksum, permitted use/publication, and pipeline/config version.

Do not commit OSM/PBF, PMTiles, MBTiles, Parquet/Arrow, full simulation outputs, personal data, or provider secrets. Test fixtures belong in `tests/fixtures` only after license and size review.

`data/manifests` contains small reviewed provenance records only. The Phase 1A Toronto reference manifest records the query and exact raw response hashes; its `raw_local_path` is intentionally ignored and must be reacquired or supplied separately before import.
