# Graph fixtures

`basic-network.input.json` is an original synthetic normalized-import fixture created for VECTORSHIFT. It is licensed under the repository's Apache-2.0 license and contains no external map data.

The recipe identity is `vectorshift:synthetic:basic-network:v1`; its SHA-256 is recorded as the source hash in the fixture. Coordinates are fictional topology near Toronto-scale longitude/latitude values and are not assertions about real roads.

Expected import:

- 4 nodes;
- 4 directed edges: one bidirectional segment plus two parallel one-way segments;
- 1 explicit forbidden turn;
- 2 weak components with sizes 3 and 1;
- 1 isolated node and 1 parallel directed-edge group;
- 450,000 mm total directed length.
