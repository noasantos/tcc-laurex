import type { Doc, State } from "./types";

// Containers and layout-only nodes have no academic content on their own.
const containers = new Set([
  "doc",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "hardBreak",
]);
export function hasDocumentContent(node: Doc): boolean {
  if (node.type === "text") return Boolean(node.text?.trim());
  if (node.content?.some(hasDocumentContent)) return true;
  return !containers.has(node.type);
}
export function synchronizeChapterStatus(state: State, before: State) {
  for (const chapter of state.chapters) {
    const old = before.chapters.find((c) => c.id === chapter.id);
    chapter.started = Boolean(
      chapter.started ||
      old?.started ||
      (old && old.status !== "Planejado") ||
      chapter.status !== "Planejado" ||
      hasDocumentContent(chapter.content),
    );
    if (chapter.started && chapter.status === "Planejado")
      chapter.status = "Em desenvolvimento";
    if (
      old &&
      chapter.revision === old.revision &&
      (chapter.status !== old.status || chapter.started !== old.started)
    )
      chapter.revision++;
  }
}
