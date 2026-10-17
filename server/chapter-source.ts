import { exportLatex, importLatex } from "./documents";
import { plain, type Chapter, type Doc, type State } from "./types";

/** Native TeX is stored verbatim. The visual document is only a supported projection. */
export function projectLatex(latex: string, previous?: Doc) {
  let projected: ReturnType<typeof importLatex>;
  try {
    projected = importLatex(latex, true);
  } catch {
    projected = {
      doc: {
        type: "doc",
        content: [
          {
            type: "rawLatex",
            attrs: { id: crypto.randomUUID(), source: latex },
          },
        ],
      },
      warnings: [
        "O fonte contém sintaxe incompleta. Ele foi preservado; revise o código LaTeX.",
      ],
    };
  }
  // Unchanged blocks retain their structural identity after insertions and moves.
  const candidates = new Map<string, Doc[]>();
  for (const block of previous?.content || []) {
    const key = block.type + "\0" + plain(block);
    candidates.set(key, [...(candidates.get(key) || []), block]);
  }
  for (const block of projected.doc.content || []) {
    const match = candidates.get(block.type + "\0" + plain(block))?.shift();
    if (match?.attrs?.id) block.attrs = { ...block.attrs, id: match.attrs.id };
  }
  return projected;
}
export function setChapterLatex(chapter: Chapter, latex: string) {
  const projection = projectLatex(latex, chapter.content);
  chapter.latex = latex;
  chapter.latexRevision = (chapter.latexRevision || 0) + 1;
  chapter.content = projection.doc;
  chapter.latexWarnings = projection.warnings;
  delete chapter.latexIssue;
}
export function visualLatex(content: Doc, chapterId?: string) {
  // Assets are materialized separately; do not replace local figures with invented URLs.
  return exportLatex(
    content,
    {},
    chapterId ? `figures/${encodeURIComponent(chapterId)}/` : "figures/",
  );
}
export function synchronizeSources(state: State, before: State) {
  for (const chapter of state.chapters) {
    const old = before.chapters.find((c) => c.id === chapter.id);
    const contentChanged =
      !old || JSON.stringify(chapter.content) !== JSON.stringify(old.content);
    if (
      chapter.latex !== undefined &&
      (chapter.latex !== old?.latex ||
        chapter.latexRevision !== old?.latexRevision)
    )
      continue;
    if (!contentChanged && chapter.latex !== undefined) continue;
    if (
      chapter.latex !== undefined &&
      old?.latex !== undefined &&
      old.latexWarnings?.length &&
      contentChanged
    )
      throw new Error(
        "Este fonte possui construções protegidas. Revise pelo código LaTeX para preservar o original.",
      );
    try {
      chapter.latex = visualLatex(chapter.content, chapter.id);
      chapter.latexRevision = (chapter.latexRevision || 0) + 1;
      chapter.latexWarnings = chapter.content.content?.some(
        (b) => b.type === "rawLatex",
      )
        ? projectLatex(chapter.latex).warnings
        : [];
      delete chapter.latexIssue;
    } catch (error) {
      // Legacy documents that cannot be converted stay fully recoverable as visual documents.
      if (old?.latex !== undefined) throw error;
      chapter.latexIssue = (error as Error).message;
    }
  }
}
