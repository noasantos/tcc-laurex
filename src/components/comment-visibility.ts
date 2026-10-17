export type ReadingRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};
/** A short selection must be fully readable. For a selection taller than the
 * viewport, its first line must be readable in the upper half of the pane. */
export function isCommentAnchorVisible(
  rectangles: ReadingRect[],
  viewport: ReadingRect,
) {
  const lines = rectangles.filter((r) => r.right > r.left && r.bottom > r.top);
  if (
    !lines.length ||
    viewport.bottom <= viewport.top ||
    viewport.right <= viewport.left
  )
    return false;
  const epsilon = 2;
  const horizontal = (r: ReadingRect) =>
    r.left >= viewport.left - epsilon && r.right <= viewport.right + epsilon;
  const top = Math.min(...lines.map((r) => r.top)),
    bottom = Math.max(...lines.map((r) => r.bottom));
  if (bottom - top <= viewport.bottom - viewport.top)
    return lines.every(
      (r) =>
        horizontal(r) &&
        r.top >= viewport.top - epsilon &&
        r.bottom <= viewport.bottom + epsilon,
    );
  const first = lines.reduce((a, b) => (a.top <= b.top ? a : b));
  return (
    horizontal(first) &&
    first.top >= viewport.top - epsilon &&
    first.bottom <= viewport.bottom + epsilon &&
    first.top <= (viewport.top + viewport.bottom) / 2
  );
}
