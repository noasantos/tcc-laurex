import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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
import type { Chapter } from "../../server/types";
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

export function LatexSource({
  chapter,
  onClose,
}: {
  chapter: Chapter;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
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
