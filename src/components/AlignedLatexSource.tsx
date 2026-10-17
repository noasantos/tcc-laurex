import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { highlightTree, classHighlighter } from "@lezer/highlight";
import type { Chapter, Doc } from "../../server/types";
import type { AlignedBlock } from "../../server/latex-alignment";
import { request } from "../api";
import {
  fontMetrics,
  measureLines,
  mathBaseline,
  clearFontMetrics,
} from "./aligned-lines";
import "./aligned-source.css";

type Row = {
  key: string;
  from: number;
  to: number;
  top: number;
  height: number;
  baseline: number;
  line: number;
};
type Token = { from: number; to: number; className: string };
const language = StreamLanguage.define(stex);
const codeFont = "12px ui-monospace, SFMono-Regular, Consolas, monospace";
const lineHeight = 24;
export function AlignedLatexSource({
  chapter,
  content,
  visual,
  onOriginal,
}: {
  chapter: Chapter;
  content: Doc;
  visual: React.RefObject<HTMLDivElement | null>;
  onOriginal: () => void;
}) {
  const source = chapter.latex;
  const [mapping, setMapping] = useState<{
    blocks: AlignedBlock[];
    error?: string;
  }>({ blocks: [] });
  const [rows, setRows] = useState<Row[]>([]);
  const [height, setHeight] = useState(0);
  const [layoutError, setLayoutError] = useState("");
  const pane = useRef<HTMLElement>(null);
  const serialized = JSON.stringify(content);
  const lineStarts = useMemo(() => {
    const result = [0];
    for (let i = 0; i < (source?.length || 0); i++)
      if (source![i] === "\n") result.push(i + 1);
    return result;
  }, [source]);
  const lineAt = (offset: number) => {
    let low = 0,
      high = lineStarts.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (lineStarts[mid] <= offset) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const tokens = useMemo(() => {
    const result: Token[] = [];
    if (source !== undefined)
      highlightTree(
        language.parser.parse(source),
        classHighlighter,
        (from, to, className) => result.push({ from, to, className }),
      );
    return result;
  }, [source]);
  useEffect(() => {
    let active = true;
    setMapping({ blocks: [] });
    setRows([]);
    if (source === undefined) return;
    request<{ blocks: AlignedBlock[]; error?: string }>("latex-alignment", {
      source,
      content: JSON.parse(serialized),
    })
      .then((result) => {
        if (active) setMapping(result);
      })
      .catch((error) => {
        if (active) setMapping({ blocks: [], error: error.message });
      });
    return () => {
      active = false;
    };
  }, [source, serialized]);
  useLayoutEffect(() => {
    const body = visual.current,
      code = pane.current;
    if (!body || !code || source === undefined || !mapping.blocks.length)
      return;
    let frame = 0,
      disposed = false;
    let blocks = Array.from(body.querySelectorAll<HTMLElement>(".tiptap > *"));
    const measure = () => {
      if (disposed) return;
      try {
        const current = Array.from(
          body.querySelectorAll<HTMLElement>(".tiptap > *"),
        );
        if (
          current.length !== blocks.length ||
          current.some((node, i) => node !== blocks[i])
        ) {
          observer.disconnect();
          observer.observe(body);
          blocks = current;
          for (const node of blocks) observer.observe(node);
        }
        if (blocks.some((node) => !node.isConnected)) return;
        // Reserve real visual space for source-only lines; no second scroll position exists.
        for (const block of mapping.blocks) {
          const node = blocks[block.index];
          if (!node) throw new Error("Aguardando a atualização do documento.");
          const first = block.offsets[0] ?? block.start;
          const prefixEnd = source.lastIndexOf("\n", first - 1) + 1;
          const prefix =
            prefixEnd > block.start ? source.slice(block.start, prefixEnd) : "";
          const prefixCount = prefix.trim() ? prefix.split("\n").length - 1 : 0;
          node.style.setProperty(
            "--source-align-before",
            `${prefixCount * lineHeight}px`,
          );
          if (block.atomic)
            node.style.setProperty(
              "--source-align-min-height",
              `${source.slice(block.start, block.end).trim().split("\n").length * lineHeight}px`,
            );
        }
        const origin = code.getBoundingClientRect().top;
        const next: Row[] = [];
        const add = (
          key: string,
          from: number,
          to: number,
          baseline: number,
          h: number,
        ) => {
          next.push({
            key,
            from,
            to,
            baseline: baseline - origin,
            top: baseline - origin - fontMetrics(codeFont, `${h}px`).baseline,
            height: h,
            line: lineAt(from),
          });
        };
        for (const block of mapping.blocks) {
          const node = blocks[block.index];
          if (block.atomic) {
            const text = source.slice(block.start, block.end),
              leading = text.length - text.trimStart().length;
            let from = block.start + leading;
            const physical = source
              .slice(from, block.end)
              .trimEnd()
              .split("\n");
            const formulaBaseline =
              content.content?.[block.index]?.type === "blockMath"
                ? mathBaseline(node)
                : null;
            const bodyLine = physical.findIndex(
              (line) => line.trim() && !/^\\(?:begin|end)\b/.test(line.trim()),
            );
            const y =
              formulaBaseline !== null
                ? formulaBaseline - Math.max(0, bodyLine) * lineHeight
                : node.getBoundingClientRect().top +
                  fontMetrics(codeFont, `${lineHeight}px`).baseline;
            physical.forEach((line, i) => {
              add(
                `${block.index}-atom-${i}`,
                from,
                from + line.length,
                y + i * lineHeight,
                lineHeight,
              );
              from += line.length + 1;
            });
            continue;
          }
          const measured = measureLines(
            node,
            content.content?.[block.index]?.type === "rawLatex",
          );
          if (measured.length !== block.offsets.length)
            throw new Error(
              "Este bloco não tem uma correspondência textual segura. Consulte o código original.",
            );
          if (!measured.lines.length) continue;
          let from = block.start;
          const first = block.offsets[0] ?? block.start;
          const prefixEnd = source.lastIndexOf("\n", first - 1) + 1;
          if (prefixEnd > from && source.slice(from, prefixEnd).trim()) {
            const prefix = source.slice(from, prefixEnd).split("\n");
            prefix.pop();
            prefix.forEach((line, i) => {
              add(
                `${block.index}-prefix-${i}`,
                from,
                from + line.length,
                measured.lines[0].baseline - (prefix.length - i) * lineHeight,
                lineHeight,
              );
              from += line.length + 1;
            });
          }
          measured.lines.forEach((line, i) => {
            const to =
              i + 1 < measured.lines.length
                ? block.offsets[measured.lines[i + 1].first]
                : block.end;
            add(`${block.index}-${i}`, from, to, line.baseline, line.height);
            from = to;
          });
        }
        setLayoutError("");
        setRows((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
        );
        const h = Math.max(body.offsetHeight, body.scrollHeight);
        setHeight((previous) => (previous === h ? previous : h));
      } catch (error) {
        setLayoutError((error as Error).message);
        setRows([]);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(body);
    for (const block of blocks) observer.observe(block);
    const changes = new MutationObserver(schedule);
    changes.observe(body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const fontsChanged = () => {
      clearFontMetrics();
      schedule();
    };
    document.fonts.ready.then(fontsChanged);
    document.fonts.addEventListener("loadingdone", fontsChanged);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      changes.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsChanged);
      for (const node of blocks) {
        node.style.removeProperty("--source-align-before");
        node.style.removeProperty("--source-align-min-height");
      }
    };
  }, [mapping, source, serialized, visual]);
  const rowText = (row: Row) => {
    let from = row.from,
      to = row.to;
    while (from < to && /[\r\n]/.test(source![from])) from++;
    while (to > from && /[\r\n]/.test(source![to - 1])) to--;
    const offsets: number[] = [],
      characters: string[] = [];
    for (let i = from; i < to; i++) {
      offsets.push(i);
      characters.push(/[\r\n]/.test(source![i]) ? " " : source![i]);
    }
    offsets.push(to);
    return { from, to, offsets, text: characters.join("") };
  };
  function copy(event: React.ClipboardEvent) {
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed) return;
    const point = (node: Node | null, offset: number) => {
      const element = node instanceof Element ? node : node?.parentElement;
      const parent = element?.closest<HTMLElement>("[data-source-row]");
      const code = parent?.querySelector("code");
      const row = rows.find((row) => row.key === parent?.dataset.sourceRow);
      if (!node || !code || !row || !code.contains(node)) return null;
      const range = document.createRange();
      range.setStart(code, 0);
      range.setEnd(node, offset);
      const mapped = rowText(row);
      return mapped.offsets[
        Math.min(range.toString().length, mapped.offsets.length - 1)
      ];
    };
    const from = point(selected.anchorNode, selected.anchorOffset),
      to = point(selected.focusNode, selected.focusOffset);
    if (from !== null && to !== null) {
      event.preventDefault();
      event.clipboardData.setData(
        "text/plain",
        source!.slice(Math.min(from, to), Math.max(from, to)),
      );
    }
  }
  const error =
    mapping.error ||
    layoutError ||
    (source === undefined
      ? chapter.latexIssue || "Fonte LaTeX indisponível."
      : "");
  return (
    <aside
      ref={pane}
      className="aligned-latex-source"
      aria-label="LaTeX alinhado ao documento"
      onCopy={copy}
      style={{ minHeight: height || undefined }}
    >
      {error ? (
        <div className="aligned-source-notice" role="status">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={onOriginal}>
            Ver código original
          </button>
        </div>
      ) : !mapping.blocks.length ? (
        <p className="aligned-source-notice">Alinhando as linhas…</p>
      ) : (
        rows.map((row, rowIndex) => {
          const mapped = rowText(row);
          const spans: React.ReactNode[] = [];
          let cursor = mapped.from;
          for (const token of tokens) {
            if (token.to <= cursor) continue;
            if (token.from >= mapped.to) break;
            if (token.from > cursor)
              spans.push(
                <span key={"p" + cursor}>
                  {source!
                    .slice(cursor, Math.min(token.from, mapped.to))
                    .replace(/[\r\n]/g, " ")}
                </span>,
              );
            const start = Math.max(cursor, token.from),
              end = Math.min(mapped.to, token.to);
            spans.push(
              <span className={token.className} key={"t" + start}>
                {source!.slice(start, end).replace(/[\r\n]/g, " ")}
              </span>,
            );
            cursor = end;
          }
          if (cursor < mapped.to)
            spans.push(
              <span key={"p" + cursor}>
                {source!.slice(cursor, mapped.to).replace(/[\r\n]/g, " ")}
              </span>,
            );
          return (
            <div
              className="aligned-code-row"
              data-source-row={row.key}
              data-visual-baseline={row.baseline}
              key={row.key}
              style={{
                top: row.top,
                height: row.height,
                lineHeight: `${row.height}px`,
              }}
            >
              <span className="aligned-line-number" aria-hidden="true">
                {rowIndex === 0 || rows[rowIndex - 1].line !== row.line
                  ? row.line
                  : ""}
              </span>
              <code>{spans}</code>
              <i className="aligned-code-baseline" aria-hidden="true" />
            </div>
          );
        })
      )}
    </aside>
  );
}
