import type { Doc, Comment } from "./types";
export const anchorText = (d: Doc): string =>
  d.text || (d.content || []).map(anchorText).join("");
export function resolveAnchor(doc: Doc, comment: Comment) {
  const blocks: Doc[] = [];
  function collect(d: Doc) {
    if (d.attrs?.id && ["paragraph", "heading", "codeBlock"].includes(d.type))
      blocks.push(d);
    else for (const c of d.content || []) collect(c);
  }
  collect(doc);
  const ids = comment.anchor.blockIds?.length
    ? comment.anchor.blockIds
    : comment.anchor.blockId
      ? [comment.anchor.blockId]
      : [];
  if (!ids.length)
    return {
      status: comment.anchor.scope === "chapter" ? "chapter" : "orphan",
      ranges: [],
    };
  let targets = ids.map((id) => blocks.find((b) => b.attrs?.id === id));
  let recovered = false;
  if (targets.some((b) => !b)) {
    const candidates = blocks.filter((b) => {
      const text = anchorText(b),
        at = text.indexOf(comment.quote);
      return (
        comment.quote &&
        at >= 0 &&
        text.indexOf(comment.quote, at + 1) < 0 &&
        (!comment.anchor.prefix ||
          text.slice(Math.max(0, at - comment.anchor.prefix.length), at) ===
            comment.anchor.prefix) &&
        (!comment.anchor.suffix ||
          text.slice(
            at + comment.quote.length,
            at + comment.quote.length + comment.anchor.suffix.length,
          ) === comment.anchor.suffix)
      );
    });
    if (candidates.length !== 1) return { status: "orphan", ranges: [] };
    targets = [candidates[0]];
    recovered = true;
  }
  const texts = targets.map((b) => anchorText(b!));
  const joined = texts.join(" ");
  const from = joined.indexOf(comment.quote);
  if (
    comment.quote &&
    (from < 0 || joined.indexOf(comment.quote, from + 1) >= 0)
  )
    return { status: "orphan", ranges: [] };
  const to = comment.quote ? from + comment.quote.length : joined.length;
  let offset = 0;
  const ranges = targets.flatMap((b, i) => {
    const start = offset;
    offset += texts[i].length + 1;
    const localFrom = Math.max(0, from - start),
      localTo = Math.min(texts[i].length, to - start);
    return localTo > localFrom
      ? [{ blockId: String(b!.attrs!.id), from: localFrom, to: localTo }]
      : [];
  });
  return { status: recovered ? "recovered" : "linked", ranges };
}
