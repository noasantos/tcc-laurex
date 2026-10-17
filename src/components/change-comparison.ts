import { diffArrays } from "diff";
import type { Doc, Proposal } from "../../server/types";

/** Readable projection for comparison only. Never used to write academic source. */
export function comparisonText(node: Doc): string {
  if (node.type === "text") return node.text || "";
  const children = (node.content || []).map(comparisonText).join("");
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image")
    return `[Figura: ${node.attrs?.alt || node.attrs?.src || "sem legenda"}]\n`;
  if (["inlineMath", "blockMath"].includes(node.type))
    return `$${node.attrs?.latex || children}$`;
  if (node.type === "citation")
    return `[Citação: ${node.attrs?.referenceId || node.attrs?.key || children}]`;
  if (node.type === "footnote")
    return `[Nota: ${node.attrs?.text || children}]`;
  if (node.type === "rawLatex")
    return String(node.attrs?.source || node.attrs?.latex || children);
  if (node.type === "tableCell" || node.type === "tableHeader")
    return children.trim() + " | ";
  if (
    ["paragraph", "heading", "tableRow", "listItem", "blockMath"].includes(
      node.type,
    )
  )
    return children + "\n";
  return children;
}
export function comparisonSource(p: Proposal) {
  const before = comparisonText(p.before),
    after = comparisonText(p.after);
  // A format/unsupported-node edit must not disappear behind a plain-text diff.
  const sourceRequired = before === after && p.beforeLatex !== p.afterLatex;
  return { before, after, sourceRequired };
}
export type ComparisonRow = {
  before?: string;
  after?: string;
  oldLine?: number;
  newLine?: number;
  changed: boolean;
  omitted?: number;
};
export function comparisonRows(
  before: string,
  after: string,
  context = 2,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  let oldLine = 1,
    newLine = 1;
  const changes = diffArrays(before.split("\n"), after.split("\n"));
  for (let i = 0; i < changes.length; i++) {
    const part = changes[i];
    if (part.removed) {
      const added = changes[i + 1]?.added ? changes[++i].value : [];
      for (let j = 0; j < Math.max(part.value.length, added.length); j++)
        rows.push({
          before: part.value[j],
          after: added[j],
          oldLine: j < part.value.length ? oldLine++ : undefined,
          newLine: j < added.length ? newLine++ : undefined,
          changed: true,
        });
    } else if (part.added) {
      for (const line of part.value)
        rows.push({ after: line, newLine: newLine++, changed: true });
    } else
      for (const line of part.value)
        rows.push({
          before: line,
          after: line,
          oldLine: oldLine++,
          newLine: newLine++,
          changed: false,
        });
  }
  const changed = rows.flatMap((r, i) => (r.changed ? [i] : []));
  if (!changed.length) return [];
  const visible = new Set<number>();
  for (const index of changed)
    for (
      let i = Math.max(0, index - context);
      i <= Math.min(rows.length - 1, index + context);
      i++
    )
      visible.add(i);
  const focused: ComparisonRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (visible.has(i)) focused.push(rows[i]);
    else {
      let count = 1;
      while (i + 1 < rows.length && !visible.has(i + 1)) {
        count++;
        i++;
      }
      focused.push({ changed: false, omitted: count });
    }
  }
  return focused;
}
