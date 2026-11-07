# Web-specific instructions

These rules extend the root [AGENTS.md](../../AGENTS.md).

- Keep authoritative server state, unsaved local drafts, URL/view state, and derived render state separate.
- Every map operation needs a keyboard-accessible path and a non-map representation of essential information.
- Implement loading, empty, validation, revision-conflict, quota, offline/reconnect, gap-recovery, partial, and terminal error states with the feature that introduces them.
- Respect reduced motion; never use color alone for disruption or status. Target WCAG 2.2 AA.
- Measure representative render, input latency, memory, and asset transfer before making performance claims or adding deck.gl/custom GPU work.
- Do not place access credentials in URLs, browser logs, analytics, or persisted client stores.
- Keep simulation claims labeled synthetic with visible versions and limitations.

Use the frontend-design review skill for material interaction or visualization changes.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
