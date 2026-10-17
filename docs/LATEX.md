# Academic source boundary

`@unified-latex/unified-latex-util-parse` produces an AST. The importer inspects nested macro arguments and environments, not regular-expression replacements of complex documents. Original `.tex`, `.docx` and project ZIP bytes are archived and included in backups.

## Supported visual LaTeX import

Plain paragraphs, explicit section/subsection/subsubsection headings, textbf/emph/textit, basic cite/citep/citet and footnote. Native source projection additionally reads comments without displaying them as academic content, and renders supported inline/display math and equation/equation* through KaTeX with trust disabled and bounded expansion. Such sources are protected from visual rewriting so original comments, delimiters and environments remain intact. Semantic whitespace may be normalized in this subset. Structural paragraph and heading IDs are generated.

If any unsupported node, macro, environment or nonempty optional argument occurs, the **entire imported source remains a protected raw block**. This conservative choice prevents partial conversion from silently losing a custom macro nested inside a supported command. Protected sources export byte-for-byte. Native chapters containing these protected blocks require source proposals; visual replacement is blocked to prevent losing commands.

A ZIP is preserved as a full original, but only the selected main `.tex` is inspected for the visual view. Includes, classes, style files, fonts, external images, bibliography processors and custom commands are not expanded or synchronized bidirectionally. Continue compiling the canonical original project in the already installed LaTeX tool.

Word import is deliberately labeled text-only. It preserves the original archive but does not preserve its formatting in the visual representation. It is not a faithful DOCX-to-LaTeX converter.

## Native source and code view

Each convertible chapter has a canonical `chapter.latex` string. It is native TeX, not HTML, Markdown or an editor JSON projection. Incoming LaTeX is stored verbatim in SQLite transactions, document versions and full backups. `content` remains a derived visual projection for selections/comments. The app atomically materializes `<data>/academic/chapters/<chapter-id>.tex` and local visual figure assets; these are recoverable read copies of the committed source, regenerated on startup. Edit through MCP/the application, not these generated copies. Original imports remain archived separately and are never replaced.

Existing visual chapters receive a backup and a versioned migration before their first native source is created. Their existing visual structure and block IDs remain unchanged. If a legacy construct cannot be safely exported, the visual chapter stays intact with an explicit conversion issue; the app never invents TeX or labels it native. Supported visual edits update the source transactionally; this supported subset may normalize TeX formatting. Chapters with unsupported original constructs are protected from visual edits, which could discard commands. Revision requires a native-source proposal instead.

The document offers **Visual**, **Código LaTeX** and **Lado a lado**. The code view uses CodeMirror 6 with its official TeX mode, syntax highlighting, line numbers, wrapping, bracket matching, selection/copy, and light/dark colors. CodeMirror is loaded only when a code view is requested. The code pane shows the saved canonical source, not an unsaved visual draft. It is read-only; manual editing remains available in the supported visual editor, while native code revisions are proposed through MCP. This is a source view, not an Overleaf PDF renderer.

`create_chapter` accepts `latex`. `get_chapter`/`get_chapter_latex` return the native source and chapter revision. `propose_latex_edit` (alias of `propose_edit`) accepts `afterLatex` plus `chapterRevision`, `expectedRevision`, a reason and optional comment ID. `after` JSON remains a compatibility path for supported visual documents; never send both formats. Full before/after native sources are retained and can be compared in the proposal. Laura must approve locally before `apply_approved_edit`. Metadata updates never regenerate an existing native source. Unchanged projected blocks retain their structural IDs; removed/unsupported selections remain traceable through the comment recovery mechanism.

Both panes scroll inside the screen. Synchronization maps recognizable top-level blocks; if exact correspondence is unavailable, it uses proportional scrolling. It does not claim SyncTeX precision. Disable it with the link button. Narrow layouts stack the panes; source-only mode keeps a full-width code area.

A source can contain arbitrary TeX without being executed. Incomplete syntax is preserved and identified as protected source. Complex source still has a conservative visual projection, not a full bidirectional TeX editor. Unsupported macros, tables, packages and full institutional projects remain intact but are not falsely rendered as a faithful visual document.

## Export

Academic ZIP includes chapter `.tex` files and bibliography; it excludes planning, personal notes and comments. Supported text styles, simple lists, headings, footnotes, citations, basic rectangular tables and PNG/JPEG figures are exported. Unsupported constructs block the export with a message rather than disappearing. WebP should be converted to PNG/JPEG before LaTeX export. Full-workspace backup preserves all visual content even when a LaTeX exporter rejects it.

The package is a set of academic fragments, not an automatically certified abnTeX2/UFRJ project. Review headings, author-year citation style, preamble and institutional requirements in the canonical project. Imported complete sources can already contain documentclass/begin-document and must not be blindly wrapped in another document.

## PDF

The app detects pdflatex/xelatex/tectonic and compiles **generated visual content only** into an isolated directory, with a timeout and shell escape disabled. Raw imported TeX is not executed. Free-form visual math accepts a small command allowlist before export. Compilation errors return a readable log without replacing a saved document. Tectonic may need network access to populate its own TeX package cache on a first compile; offline reading/editing/comments do not depend on it.

The generated PDF is for review. It does not establish ABNT/UFRJ layout compliance, bibliography accuracy or equivalence to a complex original thesis.
