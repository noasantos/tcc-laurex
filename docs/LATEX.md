# Academic source boundary

`@unified-latex/unified-latex-util-parse` produces an AST. The importer inspects nested macro arguments and environments, not regular-expression replacements of complex documents. Original `.tex`, `.docx` and project ZIP bytes are archived and included in backups.

## Supported visual LaTeX import

Plain paragraphs, explicit section/subsection/subsubsection headings, textbf/emph/textit, basic cite/citep/citet and footnote. Semantic whitespace may be normalized in this subset. Structural paragraph and heading IDs are generated.

If any unsupported node, macro, environment or nonempty optional argument occurs, the **entire imported source remains a protected raw block**. This conservative choice prevents partial conversion from silently losing a custom macro nested inside a supported command. Protected sources export byte-for-byte. The editor can surround a protected block with new visual content, but cannot pretend to provide safe bidirectional editing of arbitrary LaTeX.

A ZIP is preserved as a full original, but only the selected main `.tex` is inspected for the visual view. Includes, classes, style files, fonts, external images, bibliography processors and custom commands are not expanded or synchronized bidirectionally. Continue compiling the canonical original project in the already installed LaTeX tool.

Word import is deliberately labeled text-only. It preserves the original archive but does not preserve its formatting in the visual representation. It is not a faithful DOCX-to-LaTeX converter.

## Side-by-side source view

“Ver LaTeX” in the document header opens a read-only code pane beside the visual editor. Reading remains the default. The code follows the current visual content, including local edits and updates received from the assistant; planning, notes and comments are excluded. Protected raw LaTeX blocks retain their exact source. This is a chapter content projection, not a full canonical project/preamble browser or a bidirectional source editor.

Both panes scroll independently within the screen. Synchronization is enabled initially and maps matching top-level document blocks, interpolating within each block despite different rendered heights. The link button disables synchronization. On narrow screens the panes stack vertically. An unsupported conversion displays a message at its block without changing or hiding the academic source. The preview endpoint validates the document, requires the local session and never writes project data or compiles TeX.

## Export

Academic ZIP includes chapter `.tex` files and bibliography; it excludes planning, personal notes and comments. Supported text styles, simple lists, headings, footnotes, citations, basic rectangular tables and PNG/JPEG figures are exported. Unsupported constructs block the export with a message rather than disappearing. WebP should be converted to PNG/JPEG before LaTeX export. Full-workspace backup preserves all visual content even when a LaTeX exporter rejects it.

The package is a set of academic fragments, not an automatically certified abnTeX2/UFRJ project. Review headings, author-year citation style, preamble and institutional requirements in the canonical project. Imported complete sources can already contain documentclass/begin-document and must not be blindly wrapped in another document.

## PDF

The app detects pdflatex/xelatex/tectonic and compiles **generated visual content only** into an isolated directory, with a timeout and shell escape disabled. Raw imported TeX is not executed. Free-form visual math accepts a small command allowlist before export. Compilation errors return a readable log without replacing a saved document. Tectonic may need network access to populate its own TeX package cache on a first compile; offline reading/editing/comments do not depend on it.

The generated PDF is for review. It does not establish ABNT/UFRJ layout compliance, bibliography accuracy or equivalence to a complex original thesis.
