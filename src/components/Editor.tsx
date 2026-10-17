import { useEditor, EditorContent } from "@tiptap/react";
import { LatexSource } from "./LatexSource";
import { BubbleMenu } from "@tiptap/react/menus";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import UniqueID from "@tiptap/extension-unique-id";
import Mathematics from "@tiptap/extension-mathematics";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  MessageCirclePlus,
  Undo2,
  Redo2,
  Plus,
  Check,
  Table2,
  Quote,
  ImagePlus,
  Sigma,
  ArrowUpRight,
  FileText,
  Code2,
} from "lucide-react";
import type { Chapter, Comment, Doc } from "../../server/types";
import { resolveAnchor } from "../../server/anchors";
import "katex/dist/katex.min.css";
const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ key: { default: "" }, label: { default: "" } }),
  parseHTML: () => [{ tag: "button[data-citation]" }],
  renderHTML({ node, HTMLAttributes }) {
    return [
      "button",
      mergeAttributes(HTMLAttributes, {
        "data-citation": node.attrs.key,
        type: "button",
        class: "citation",
      }),
      node.attrs.label || node.attrs.key,
    ];
  },
});
const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({
    id: { default: null },
    number: { default: null },
    text: { default: "" },
  }),
  parseHTML: () => [{ tag: "button[data-footnote]" }],
  renderHTML({ node, HTMLAttributes }) {
    return [
      "button",
      mergeAttributes(HTMLAttributes, {
        "data-footnote": node.attrs.text,
        type: "button",
        class: "footnote",
        title: "Abrir nota de rodapé",
      }),
      "†",
    ];
  },
});
const CrossRef = Node.create({
  name: "crossReference",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ targetId: { default: "" }, label: { default: "" } }),
  parseHTML: () => [{ tag: "button[data-cross-reference]" }],
  renderHTML({ node }) {
    return [
      "button",
      {
        "data-cross-reference": node.attrs.targetId,
        type: "button",
        class: "citation",
      },
      node.attrs.label,
    ];
  },
});
const RawLatex = Node.create({
  name: "rawLatex",
  group: "block",
  atom: true,
  addAttributes: () => ({ source: { default: "" }, id: { default: null } }),
  parseHTML: () => [{ tag: "pre[data-latex]" }],
  renderHTML({ node }) {
    return [
      "pre",
      {
        "data-latex": "preserved",
        class: "latex-preserved",
        contenteditable: "false",
      },
      ["strong", {}, "LaTeX original preservado · bloco protegido"],
      ["code", {}, node.attrs.source],
    ];
  },
});
export type SelectionAnchor = {
  rect?: { left: number; top: number; bottom: number; right: number };
  quote: string;
  anchor: {
    blockId?: string;
    prefix?: string;
    suffix?: string;
    scope?: string;
    blockIds?: string[];
  };
};
export function DocumentEditor({
  chapter,
  comments,
  onSave,
  onComment,
  onOpenComment,
  onCitation,
  onFootnote,
  onCrossRef,
  dirtyChanged,
  onInsert,
}: {
  chapter: Chapter;
  comments: Comment[];
  onSave: (content: Doc, baseRevision: number) => Promise<number>;
  onComment: (a: SelectionAnchor) => void;
  onOpenComment: (id: string) => void;
  onCitation: (key: string, rect?: DOMRect) => void;
  onFootnote: (text: string, rect?: DOMRect) => void;
  onCrossRef: (id: string) => void;
  dirtyChanged: (v: boolean) => void;
  onInsert: (kind: string, insert: (attrs: any) => void) => void;
}) {
  const callbacks = useRef({
    onOpenComment,
    onCitation,
    onFootnote,
    onCrossRef,
  });
  callbacks.current = { onOpenComment, onCitation, onFootnote, onCrossRef };
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const changeRef = useRef(dirtyChanged);
  changeRef.current = dirtyChanged;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState("Salvo");
  const [more, setMore] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const visual = useRef<HTMLDivElement>(null);
  const [editTick, tick] = useState(0);
  const dirty = useRef(false);
  const draftAvailable = useRef(true);
  const lastSaved = useRef(JSON.stringify(chapter.content));
  const chapterId = chapter.id;
  const baseRevision = useRef(chapter.revision);
  const saving = useRef(Promise.resolve());
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: { openOnClick: false } }),
        TableKit.configure({ table: { resizable: false } }),
        Image.configure({ allowBase64: true }),
        UniqueID.configure({
          types: [
            "paragraph",
            "heading",
            "table",
            "image",
            "codeBlock",
            "blockquote",
          ],
          attributeName: "id",
        }),
        Mathematics,
        Citation,
        Footnote,
        CrossRef,
        RawLatex,
        Extension.create({
          name: "commentAnchors",
          addProseMirrorPlugins() {
            return [
              new Plugin({
                key: new PluginKey("commentAnchors"),
                props: {
                  decorations(state) {
                    const decorations: Decoration[] = [];
                    const json = state.doc.toJSON() as Doc;
                    for (const c of commentsRef.current.filter(
                      (c) => c.status === "open",
                    )) {
                      const resolved = resolveAnchor(json, c);
                      for (const range of resolved.ranges) {
                        state.doc.descendants((node, pos) => {
                          if (
                            node.attrs.id !== range.blockId ||
                            !node.isTextblock
                          )
                            return;
                          if (c.anchor.scope === "paragraph") {
                            decorations.push(
                              Decoration.node(pos, pos + node.nodeSize, {
                                class: "commented-paragraph",
                                "data-comment-id": c.id,
                              }),
                            );
                            if (range === resolved.ranges.at(-1))
                              decorations.push(
                                Decoration.widget(
                                  pos + node.nodeSize - 1,
                                  () => {
                                    const element =
                                      document.createElement("span");
                                    element.className = "comment-widget";
                                    element.dataset.commentId = c.id;
                                    element.contentEditable = "false";
                                    element.textContent = c.body;
                                    return element;
                                  },
                                  { key: c.id + "-label" },
                                ),
                              );
                          } else {
                            let textOffset = 0;
                            node.descendants((child, childPos) => {
                              if (!child.isText) return;
                              const length = child.text!.length;
                              const from = Math.max(0, range.from - textOffset),
                                to = Math.min(length, range.to - textOffset);
                              if (to > from)
                                decorations.push(
                                  Decoration.inline(
                                    pos + 1 + childPos + from,
                                    pos + 1 + childPos + to,
                                    {
                                      class: "comment-highlight",
                                      "data-comment-id": c.id,
                                    },
                                  ),
                                );
                              textOffset += length;
                            });
                          }
                        });
                      }
                    }
                    return DecorationSet.create(state.doc, decorations);
                  },
                },
              }),
            ];
          },
        }),
      ],
      content: chapter.content,
      editorProps: {
        attributes: {
          "aria-label": "Conteúdo do capítulo",
          class: "academic-editor",
        },
        handleClick(_view, _pos, event) {
          const el = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-citation],[data-footnote],[data-comment-id],[data-cross-reference]",
          );
          if (el?.dataset.citation) {
            callbacks.current.onCitation(
              el.dataset.citation,
              el.getBoundingClientRect(),
            );
            return true;
          }
          if (el?.dataset.footnote) {
            callbacks.current.onFootnote(
              el.dataset.footnote,
              el.getBoundingClientRect(),
            );
            return true;
          }
          if (el?.dataset.commentId) {
            callbacks.current.onOpenComment(el.dataset.commentId);
            return true;
          }
          if (el?.dataset.crossReference) {
            callbacks.current.onCrossRef(el.dataset.crossReference);
            return true;
          }
          return false;
        },
      },
      onSelectionUpdate: () => tick((v) => v + 1),
      onUpdate({ editor }) {
        tick((v) => v + 1);
        dirty.current = true;
        changeRef.current(true);
        setState("Salvando…");
        try {
          localStorage.setItem(
            "laura-draft-" + chapterId,
            JSON.stringify({
              content: editor.getJSON(),
              baseRevision: chapter.revision,
              at: new Date().toISOString(),
            }),
          );
          draftAvailable.current = true;
        } catch {
          draftAvailable.current = false;
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void persist(editor.getJSON()), 800);
      },
    },
    [chapterId],
  );
  async function persist(content: Doc) {
    saving.current = saving.current
      .catch(() => {})
      .then(async () => {
        try {
          baseRevision.current = await saveRef.current(
            content,
            baseRevision.current,
          );
          lastSaved.current = JSON.stringify(content);
          if (
            editor &&
            JSON.stringify(editor.getJSON()) === lastSaved.current
          ) {
            dirty.current = false;
            changeRef.current(false);
            localStorage.removeItem("laura-draft-" + chapterId);
            setState("Salvo");
          }
        } catch {
          setState(
            draftAvailable.current
              ? "Falha ao salvar · rascunho preservado"
              : "Falha ao salvar · mantenha esta janela aberta",
          );
        }
      });
    await saving.current;
  }
  useEffect(() => {
    if (editor && !dirty.current) {
      if (JSON.stringify(chapter.content) !== lastSaved.current) {
        editor.commands.setContent(chapter.content, { emitUpdate: false });
        tick((v) => v + 1);
        lastSaved.current = JSON.stringify(chapter.content);
      }
      baseRevision.current = chapter.revision;
    }
    editor?.view.dispatch(editor.state.tr.setMeta("comments", true));
  }, [chapter.content, comments, editor]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => {
      window.removeEventListener("beforeunload", listener);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  if (!editor) return null;
  const button = (label: string, Icon: any, fn: () => void, active = false) => (
    <button
      title={label}
      aria-label={label}
      className={active ? "active" : ""}
      onClick={fn}
    >
      <Icon size={18} />
    </button>
  );
  const addComment = () => {
    const { from, to, $from } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ");
    const quote = selected || $from.parent.textContent;
    let blockId: string | undefined;
    const blockIds: string[] = [];
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isTextblock && node.attrs.id) blockIds.push(node.attrs.id);
    });
    for (let d = $from.depth; d > 0; d--)
      if ($from.node(d).attrs.id) {
        blockId = $from.node(d).attrs.id;
        break;
      }
    const rect = window.getSelection()?.rangeCount
      ? window.getSelection()!.getRangeAt(0).getBoundingClientRect()
      : undefined;
    onComment({
      ...(rect
        ? {
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            },
          }
        : {}),
      quote,
      anchor: {
        blockId,
        blockIds: blockIds.length ? blockIds : blockId ? [blockId] : [],
        scope: selected ? "selection" : quote ? "paragraph" : "chapter",
        prefix: $from.parent.textContent.slice(
          Math.max(0, $from.parentOffset - 32),
          $from.parentOffset,
        ),
        suffix: editor.state.doc.textBetween(
          to,
          Math.min(to + 32, editor.state.doc.content.size),
          " ",
        ),
      },
    });
    editor.commands.blur();
  };
  return (
    <>
      <BubbleMenu
        editor={editor}
        appendTo={() => document.body}
        options={{
          placement: "top",
          strategy: "fixed",
          offset: 10,
          flip: true,
          shift: { padding: 12 },
        }}
        updateDelay={100}
        shouldShow={({ editor, state }) =>
          !state.selection.empty &&
          editor.isFocused &&
          state.doc.textBetween(state.selection.from, state.selection.to).trim()
            .length > 0
        }
        className="selection-toolbar"
        role="toolbar"
        aria-label="Ferramentas do trecho selecionado"
        onMouseDown={(e) => e.preventDefault()}
      >
        {button(
          "Negrito na seleção",
          Bold,
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive("bold"),
        )}
        {button(
          "Itálico na seleção",
          Italic,
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive("italic"),
        )}
        {button(
          "Sublinhado na seleção",
          Underline,
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive("underline"),
        )}
        <span className="selection-separator" />
        <button className="selection-comment" onClick={addComment}>
          <MessageCirclePlus size={15} />
          Comentar
        </button>
      </BubbleMenu>
      <div className="document-meta">
        <span>Documento / {chapter.title}</span>
        <div className="document-meta-actions">
          <button
            className="source-toggle"
            aria-pressed={showSource}
            onClick={() => setShowSource((v) => !v)}
          >
            <Code2 size={14} /> {showSource ? "Ocultar LaTeX" : "Ver LaTeX"}
          </button>
          <span className={state.startsWith("Falha") ? "error-text" : "saved"}>
            {state === "Salvo" ? <Check size={14} /> : null}
            {state}
          </span>
        </div>
      </div>
      <div className="editor-toolbar">
        <div className="toolbar-main">
          {button(
            "Negrito",
            Bold,
            () => editor.chain().focus().toggleBold().run(),
            editor.isActive("bold"),
          )}
          {button(
            "Itálico",
            Italic,
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive("italic"),
          )}
          {button(
            "Sublinhado",
            Underline,
            () => editor.chain().focus().toggleUnderline().run(),
            editor.isActive("underline"),
          )}
          <span className="tool-separator" />
          {button(
            "Título 1",
            Heading1,
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            editor.isActive("heading", { level: 1 }),
          )}
          {button(
            "Título 2",
            Heading2,
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            editor.isActive("heading", { level: 2 }),
          )}
          {button("Lista", List, () =>
            editor.chain().focus().toggleBulletList().run(),
          )}
          <div className="dropdown">
            {button("Inserir", Plus, () => setMore(!more))}
            {more && (
              <div className="menu">
                <button
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run();
                    setMore(false);
                  }}
                >
                  <Table2 size={16} />
                  Tabela
                </button>
                <button
                  onClick={() => {
                    onInsert("citation", (a) =>
                      editor
                        .chain()
                        .focus()
                        .insertContent({ type: "citation", attrs: a })
                        .run(),
                    );
                    setMore(false);
                  }}
                >
                  <Quote size={16} />
                  Citação
                </button>
                <button
                  onClick={() => {
                    onInsert("footnote", (a) =>
                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: "footnote",
                          attrs: { ...a, id: crypto.randomUUID() },
                        })
                        .run(),
                    );
                    setMore(false);
                  }}
                >
                  <FileText size={16} />
                  Nota de rodapé
                </button>
                <button
                  onClick={() => {
                    onInsert("math", (a) =>
                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: "inlineMath",
                          attrs: { latex: a.text },
                        })
                        .run(),
                    );
                    setMore(false);
                  }}
                >
                  <Sigma size={16} />
                  Equação
                </button>
                <button
                  onClick={() => {
                    onInsert("image", (a) =>
                      editor.chain().focus().setImage(a).run(),
                    );
                    setMore(false);
                  }}
                >
                  <ImagePlus size={16} />
                  Figura local
                </button>
                <button
                  onClick={() => {
                    onInsert("crossReference", (a) =>
                      editor
                        .chain()
                        .focus()
                        .insertContent({ type: "crossReference", attrs: a })
                        .run(),
                    );
                    setMore(false);
                  }}
                >
                  <ArrowUpRight size={16} />
                  Referência cruzada
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="toolbar-end">
          {button("Desfazer", Undo2, () => editor.chain().focus().undo().run())}
          {button("Refazer", Redo2, () => editor.chain().focus().redo().run())}
          {button("Adicionar comentário", MessageCirclePlus, addComment)}
        </div>
      </div>
      <div
        className={
          "document-reading-layout" + (showSource ? " source-open" : "")
        }
      >
        <div className="document-body" ref={visual}>
          <h1 className="chapter-title">{chapter.title}</h1>
          <EditorContent editor={editor} />
        </div>
        {showSource && (
          <LatexSource
            content={editor.getJSON() as Doc}
            visual={visual}
            onClose={() => setShowSource(false)}
          />
        )}
      </div>
      <div className="document-footer">
        {editor.getText().split(/\s+/).filter(Boolean).length} palavras{" "}
        <span>Conteúdo acadêmico · planejamento guardado separadamente</span>
      </div>
    </>
  );
}
