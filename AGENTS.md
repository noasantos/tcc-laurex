# Laura Workspace — repository instructions

- Preserve all academic originals. Never silently overwrite imported sources or discard unsupported LaTeX/Word constructs.
- User data, databases, backups, credentials and logs must remain outside the source checkout. Use a temporary LAURA_DATA_DIR for tests and demos only.
- No cloud database, mandatory authentication, telemetry, embedded chat, Electron/Tauri or text-generation API.
- Existing text is revised through proposals. MCP cannot approve proposals or restore data directly; local approval is authoritative. Never auto-resolve comments after edits.
- Mutations require current project revision; document edits also require the chapter revision read by the editor. Never retry a conflict by overwriting a newer document.
- Before delivery: npm run build, npm test, npm run mcp:poc; inspect the real browser, including selected-text comments, persisted edits, dark/light modes and constrained scrolling.
- Report local protocol evidence separately from a real ChatGPT account connection. Report Windows CI separately from installation on Laura's PC.
- Design: compact grayscale, full-window application. Header/navigation stay stable. Only document/list/context bodies scroll. Contextual tools appear at the selection. No chat panel or decorative dashboards.
