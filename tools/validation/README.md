# Repository validation

`check-docs.mjs` is a dependency-free Phase 0 gate. It scans Markdown for broken relative links, missing same-file heading anchors, and machine-specific home-directory paths. `check-whitespace.mjs` validates LF endings, trailing whitespace, and exactly one final newline across non-ignored text files. Markdown hard breaks use explicit `<br>` elements rather than invisible trailing spaces.

Run both from the repository root with `npm run check`. The gates remain intentionally narrow; secret scanning, schema generation drift, license policy, and language-specific checks are added as the corresponding implementation appears.
