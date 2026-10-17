import type { Comment } from "../../server/types";
export type CommentFilters = {
  chapterId: string;
  author: string;
  query: string;
  period: string;
  sort: string;
};
export function selectComments(
  comments: Comment[],
  filters: CommentFilters,
  now = Date.now(),
) {
  const days =
    filters.period === "week"
      ? 7
      : filters.period === "month"
        ? 30
        : filters.period === "today"
          ? 1
          : 0;
  const cutoff = days ? now - days * 86400000 : 0;
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const query = normalize(filters.query.trim());
  const scoped = comments.filter(
    (c) =>
      (!filters.chapterId || c.chapterId === filters.chapterId) &&
      (!filters.author || (c.author || "Laura") === filters.author) &&
      (!cutoff || new Date(c.createdAt).getTime() >= cutoff) &&
      (!query ||
        normalize(
          [
            c.body,
            c.quote,
            c.author,
            c.id,
            "C-" + c.id.slice(0, 8),
            ...c.replies.map((r) => r.body),
          ].join(" "),
        ).includes(query)),
  );
  const sorted = scoped
    .slice()
    .sort(
      (a, b) =>
        (filters.sort === "oldest" ? 1 : -1) *
        (a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    );
  return {
    comments: sorted,
    all: sorted.length,
    open: sorted.filter((c) => c.status === "open").length,
    resolved: sorted.filter((c) => c.status === "resolved").length,
  };
}
