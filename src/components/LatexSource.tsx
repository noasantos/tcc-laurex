import { useEffect, useRef, useState } from "react";
import { Link2, Unlink2, X } from "lucide-react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { tags } from "@lezer/highlight";
import type { Chapter, Doc } from "../../server/types";
import { request } from "../api";
import { mapScroll } from "./scrollMapping";
import "./latex-source.css";

const highlighting = HighlightStyle.define([
  { tag: [tags.keyword, tags.tagName], color: "var(--tex-command)" },
  { tag: [tags.atom, tags.number, tags.bool], color: "var(--tex-number)" },
  { tag: [tags.string, tags.attributeName], color: "var(--tex-string)" },
  {
    tag: [tags.bracket, tags.meta, tags.operator],
    color: "var(--tex-punctuation)",
  },
  { tag: tags.comment, color: "var(--muted)", fontStyle: "italic" },
]);

type Block = { index: number; code: string; error: string | null };
export function LatexSource({
  chapter,
  content,
  visual,
  onClose,
  split,
}: {
  chapter: Chapter;
  content: Doc;
  visual: React.RefObject<HTMLDivElement | null>;
  split: boolean;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [synced, setSynced] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const serialized = JSON.stringify(content);
  const latex = chapter.latex;
  useEffect(() => {
    if (!host.current || latex === undefined) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latex,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          bracketMatching(),
          StreamLanguage.define(stex),
          syntaxHighlighting(highlighting),
          keymap.of(defaultKeymap),
          EditorView.lineWrapping,
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({
            "aria-label": "Fonte LaTeX do capítulo",
            "aria-readonly": "true",
            tabindex: "0",
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [latex === undefined]);
  useEffect(() => {
    const editor = view.current;
    if (editor && latex !== undefined && editor.state.doc.toString() !== latex)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: latex },
      });
  }, [latex]);
  useEffect(() => {
    if (!split) return;
    let active = true;
    request<{ blocks: Block[] }>("latex-preview", {
      content: JSON.parse(serialized),
    })
      .then((result) => {
        if (active) setBlocks(result.blocks);
      })
      .catch(() => {
        if (active) setBlocks([]);
      });
    return () => {
      active = false;
    };
  }, [serialized, split]);
  useEffect(() => {
    const left = visual.current,
      editor = view.current;
    if (!left || !editor || !split || !synced || latex === undefined) return;
    const right = editor.scrollDOM;
    let expected: { pane: HTMLElement; top: number } | null = null;
    let frame = 0;
    function sync(from: HTMLElement, to: HTMLElement, reverse: boolean) {
      if (
        expected?.pane === from &&
        Math.abs(expected.top - from.scrollTop) < 1
      ) {
        expected = null;
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visualPositions = Array.from(
          left!.querySelectorAll<HTMLElement>(".tiptap > *"),
        ).map(
          (node) =>
            node.getBoundingClientRect().top -
            left!.getBoundingClientRect().top +
            left!.scrollTop,
        );
        let cursor = 0;
        const codePositions: number[] = [];
        for (const block of blocks) {
          const fragment = block.code.trim();
          const start = fragment ? latex!.indexOf(fragment, cursor) : cursor;
          if (start < 0 || block.error) {
            codePositions.length = 0;
            break;
          }
          codePositions.push(editor!.lineBlockAt(start).top);
          cursor = start + fragment.length;
        }
        const mapped = codePositions.length === visualPositions.length;
        to.scrollTop = mapScroll(
          from.scrollTop,
          from.scrollHeight - from.clientHeight,
          to.scrollHeight - to.clientHeight,
          mapped ? (reverse ? codePositions : visualPositions) : [],
          mapped ? (reverse ? visualPositions : codePositions) : [],
        );
        expected = { pane: to, top: to.scrollTop };
      });
    }
    const onLeft = () => sync(left, right, false),
      onRight = () => sync(right, left, true);
    left.addEventListener("scroll", onLeft, { passive: true });
    right.addEventListener("scroll", onRight, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      left.removeEventListener("scroll", onLeft);
      right.removeEventListener("scroll", onRight);
    };
  }, [latex, blocks, split, synced, visual]);
  return (
    <aside className="latex-source" aria-label="Código LaTeX">
      <div className="latex-source-heading">
        <span>
          capitulo.tex{" "}
          <small>
            {latex === undefined
              ? "Conversão pendente"
              : "Fonte LaTeX · leitura"}
          </small>
        </span>
        <div>
          {split && (
            <button
              type="button"
              aria-label={
                synced
                  ? "Desativar rolagem sincronizada"
                  : "Ativar rolagem sincronizada"
              }
              aria-pressed={synced}
              title="Sincronizar rolagem"
              onClick={() => setSynced((value) => !value)}
            >
              {synced ? <Link2 size={14} /> : <Unlink2 size={14} />}
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar código LaTeX"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {latex === undefined ? (
        <p className="latex-source-message">
          {chapter.latexIssue ||
            "Este capítulo ainda não possui fonte LaTeX. O documento visual foi preservado."}
        </p>
      ) : (
        <div className="latex-code-editor" ref={host} />
      )}
      <div className="latex-source-status">
        {latex === undefined
          ? "Documento visual preservado"
          : `${latex.split("\n").length} linhas · LaTeX`}
        <span>UTF-8</span>
      </div>
    </aside>
  );
}
