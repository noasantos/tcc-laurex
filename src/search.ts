import { plain, type State } from "../server/types";
export type SearchResult = {
  id: string;
  kind: "chapter" | "comment" | "note" | "reference";
  title: string;
  excerpt: string;
  label: string;
  chapterId?: string;
};
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function searchProject(state: State, query: string): SearchResult[] {
  const tokens = normalizeSearch(query.trim()).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const rows: SearchResult[] = [];
  for (const chapter of state.chapters)
    rows.push({
      id: chapter.id,
      kind: "chapter",
      title: chapter.title,
      excerpt: plain(chapter.content) + " " + chapter.plan,
      label: "Capítulo · texto e planejamento",
    });
  for (const comment of state.comments)
    rows.push({
      id: comment.id,
      kind: "comment",
      title: comment.body,
      excerpt:
        comment.quote +
        " " +
        comment.body +
        " " +
        comment.replies.map((r) => r.body).join(" "),
      label:
        "Comentário · " +
        (state.chapters.find((c) => c.id === comment.chapterId)?.title ||
          "capítulo"),
      chapterId: comment.chapterId,
    });
  for (const note of state.notes.filter((n) => n.state !== "Arquivada"))
    rows.push({
      id: note.id,
      kind: "note",
      title: note.title || note.content.slice(0, 70),
      excerpt: note.content,
      label: "Ideia · " + note.category,
    });
  for (const reference of state.references)
    rows.push({
      id: reference.id,
      kind: "reference",
      title: reference.title,
      excerpt: [
        reference.authors,
        reference.year,
        reference.publication,
        reference.key,
        reference.doi,
        reference.note,
      ]
        .filter(Boolean)
        .join(" · "),
      label: "Fonte bibliográfica",
    });
  return rows
    .filter((row) =>
      tokens.every((token) =>
        normalizeSearch(row.title + " " + row.excerpt).includes(token),
      ),
    )
    .sort(
      (a, b) =>
        Number(tokens.every((t) => normalizeSearch(b.title).includes(t))) -
        Number(tokens.every((t) => normalizeSearch(a.title).includes(t))),
    )
    .slice(0, 30)
    .map((row) => {
      const text = row.excerpt.replace(/\s+/g, " ").trim();
      const at = normalizeSearch(text).indexOf(tokens[0]);
      const start = Math.max(0, at - 45);
      return {
        ...row,
        title: row.title.slice(0, 110),
        excerpt:
          (start ? "…" : "") +
          text.slice(start, start + 150) +
          (text.length > start + 150 ? "…" : ""),
      };
    });
}
