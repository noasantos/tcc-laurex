export type MeasuredLine = {
  first: number;
  last: number;
  baseline: number;
  height: number;
};
const metrics = new Map<string, { baseline: number; glyph: number }>();
/** Measure actual font baselines, including the platform's selected fallback font. */
export function clearFontMetrics() {
  metrics.clear();
}
export function fontMetrics(font: string, lineHeight: string) {
  const key = font + "|" + lineHeight;
  const saved = metrics.get(key);
  if (saved) return saved;
  const probe = document.createElement("span");
  Object.assign(probe.style, {
    position: "absolute",
    left: "-10000px",
    top: "0",
    font,
    lineHeight,
    whiteSpace: "pre",
    visibility: "hidden",
  });
  const text = document.createTextNode("Hg");
  const marker = document.createElement("i");
  Object.assign(marker.style, {
    display: "inline-block",
    width: "0",
    height: "0",
    padding: "0",
    border: "0",
    verticalAlign: "baseline",
  });
  probe.append(text, marker);
  document.body.append(probe);
  const range = document.createRange();
  range.selectNodeContents(text);
  const baseline = marker.getBoundingClientRect().top;
  const value = {
    baseline: baseline - probe.getBoundingClientRect().top,
    glyph: baseline - range.getBoundingClientRect().top,
  };
  probe.remove();
  metrics.set(key, value);
  return value;
}
export function measureLines(
  block: HTMLElement,
  raw = false,
): { lines: MeasuredLine[]; length: number } {
  const lines: MeasuredLine[] = [];
  let count = 0;
  const merge = (
    first: number,
    last: number,
    baseline: number,
    height: number,
  ) => {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.baseline - baseline) < 0.75) {
      previous.last = last;
      previous.height = Math.max(previous.height, height);
    } else lines.push({ first, last, baseline, height });
  };
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "",
        parent = node.parentElement!;
      const style = getComputedStyle(parent),
        height =
          parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      const metric = fontMetrics(
        style.font ||
          `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
        style.lineHeight,
      );
      let start = 0;
      while (start < text.length) {
        while (start < text.length && /\s/.test(text[start])) start++;
        if (start === text.length) break;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 1);
        const firstRect = range.getBoundingClientRect();
        let low = start + 1,
          high = text.length;
        // Binary search the actual browser wrap boundary, rather than estimating character widths.
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          range.setStart(node, mid - 1);
          range.setEnd(node, mid);
          if (range.getBoundingClientRect().top <= firstRect.top + 0.5)
            low = mid;
          else high = mid - 1;
        }
        let end = low;
        if (
          end < text.length &&
          /[\uDC00-\uDFFF]/.test(text[end]) &&
          /[\uD800-\uDBFF]/.test(text[end - 1])
        )
          end++;
        const size = text.slice(start, end).replace(/\s/g, "").length;
        if (size) {
          merge(count, count + size, firstRect.top + metric.glyph, height);
          count += size;
        }
        start = Math.max(end, start + 1);
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (
      node.matches(
        "[data-footnote],.katex-mathml,.katex-html,.ProseMirror-widget",
      )
    )
      return;
    if (node.matches('[data-type="inline-math"]')) {
      const text = node.dataset.latex || "",
        size = text.replace(/\s/g, "").length,
        rect = node.getBoundingClientRect(),
        style = getComputedStyle(node);
      const baseline =
        mathBaseline(node) ??
        rect.top +
          fontMetrics(
            style.font || `${style.fontSize} ${style.fontFamily}`,
            style.lineHeight,
          ).baseline;
      merge(count, count + size, baseline, parseFloat(style.lineHeight) || 24);
      count += size;
      return;
    }
    for (const child of node.childNodes) walk(child);
  }
  walk(raw ? block.querySelector("code") || block : block);
  return { lines, length: count };
}

/** KaTeX's strut encodes the actual equation baseline, including subscripts/fractions. */
export function mathBaseline(node: HTMLElement) {
  const strut = node.querySelector<HTMLElement>(
    ".katex-html .katex-strut,.katex-html .strut",
  );
  if (!strut) return null;
  return (
    Math.round(
      (strut.getBoundingClientRect().bottom +
        (parseFloat(getComputedStyle(strut).verticalAlign) || 0)) *
        64,
    ) / 64
  );
}
