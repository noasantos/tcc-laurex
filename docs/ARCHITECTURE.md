# Architecture

## Decision

React/Vite + Fastify. Production is one local Node.js process serving static assets, a local API and optional authenticated Streamable HTTP MCP. Stdio MCP is a separate process only while a client/tunnel uses it. No SSR, external database, background queue or cloud generation dependency. Next.js would add routing/SSR/server conventions that this single-user offline application does not need.

Node.js 22.13–26 is supported by the declared engine; LTS 24 is recommended. SQLite uses the Node runtime, avoiding a native database addon installation. Dependencies are locked in package-lock.json.

## Boundaries

- `src/components/Editor.tsx`: TipTap/ProseMirror, structural IDs, selection toolbar, local draft and serialized autosave.
- `src/components/Review.tsx`: comment inbox, context/reconciliation and proposal comparison.
- `src/components/Collections.tsx`: notebook, bibliography and overview.
- `server/domain.ts`: shared validated operations and editorial authorization; no filesystem commands exposed through tools.
- `server/store.ts`: SQLite transactions, relational link constraints, immutable snapshots, atomic JSON mirrors and source archive.
- `server/anchors.ts`: selection recovery from stable blocks, quote and context; ambiguous matches are orphaned.
- `server/documents.ts`, `imports.ts`, `export.ts`, `latex.ts`: AST import, protected originals, export and constrained compilation.
- `server/mcp.ts`: typed input schemas, JSON-compatible structured outputs, tool annotations and audit metadata.
- `server/recovery.ts`: checksum, structure and referential validation, history import, preserving restoration and actual restore verification.

## Persistence and concurrency

SQLite is the transactional authority for the visual workspace. Academic originals remain immutable source records and local archive files. `academic/workspace.json` and per-chapter JSON files are regenerable atomic mirrors, not a second competing authority. A crash between the database commit and a mirror update cannot roll back the authoritative saved document.

Every mutation writes a full project snapshot in the same transaction. WAL, synchronous FULL, foreign keys and busy timeout apply to every connection. Foreign-key link tables enforce chapter/comment/note/proposal relations. Original files are archived by generated ID; user input is never used as a filesystem path.

A mutation checks expectedRevision. A content write also checks chapterRevision. The editor keeps the base chapter revision of the text it actually loaded, rather than adopting a newer revision before overwriting it. Save requests are serialized; failures retain a local draft and expose recovery as a proposal. A UI refresh never replaces dirty editor content.

A filesystem watcher notices database changes from another MCP process and sends lightweight SSE notifications. No repeated fetch polling. The editor bundle is loaded on demand. The initial state API currently loads the complete project snapshot: this is suitable for a small thesis but is a known scaling limit for very large projects. It does not implement multi-user collaboration.

## Local security

Loopback bind only. Host/Origin and cross-site checks, per-process local CSRF token for writes, CSP, no arbitrary path access and no arbitrary process execution tools. The optional HTTP MCP route requires an operator-configured bearer secret. ChatGPT does not offer arbitrary bearer-header entry in its custom-MCP UI; use the authenticated official tunnel over stdio instead of claiming this route is directly ChatGPT-compatible.

MCP starts disabled. Read and write consent are separate. Existing content requires propose → local approve → apply. Direct remote restore and approval are denied. Imported TeX is never automatically executed. Visual math uses a command allowlist; generated compilation uses no shell escape, bounded runtime and a separate render folder. This is a constrained compiler workflow, not a general operating-system sandbox for arbitrary TeX.

## Developer commands

```sh
npm ci
npm run build
npm start
npm test
npm run mcp:poc
```

After frontend changes, build again and reload. `npm run dev` starts the TypeScript backend; it does not run a second Vite HMR server. For isolated tests/demos, set LAURA_DATA_DIR to a disposable directory outside production data. The demo seed script refuses to run without this explicit override or in a nonempty project.
