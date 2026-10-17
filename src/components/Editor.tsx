import { useEditor, EditorContent } from "@tiptap/react";
import { isCommentAnchorVisible } from "./comment-visibility";
import { CommentHover } from "./CommentHover";
import { commentReference } from "../../server/comment-reference";

import { BubbleMenu } from "@tiptap/react/menus";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import UniqueID from "@tiptap/extension-unique-id";
import Mathematics from "@tiptap/extension-mathematics";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
const AlignedLatexSource = lazy(() =>
  import("./AlignedLatexSource").then((module) => ({
    default: module.AlignedLatexSource,
  })),
);
const LatexSource = lazy(() =>
  import("./LatexSource").then((module) => ({ default: module.LatexSource })),
);
import "./latex-source.css";
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
import { plain } from "../../server/types";
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
  focusCommentId = "",
  focusRequest = 0,
  onSave,
  saveController,
  onVisibleCommentsChange,
  onComment,
  onOpenComment,
  onCitation,
  onFootnote,
  onCrossRef,
  dirtyChanged,
  onInsert,
}: {
  saveController: React.MutableRefObject<{ flush: () => Promise<void>; release: () => void } | null>;
  onVisibleCommentsChange: (value: { chapterId: string; ids: string[] }) => void;
  chapter: Chapter;
  comments: Comment[];
  focusCommentId?: string;
  focusRequest?: number;
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
  const focusCommentRef = useRef(focusCommentId);
  focusCommentRef.current = focusCommentId;
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const changeRef = useRef(dirtyChanged);
  changeRef.current = dirtyChanged;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState("Salvo");
  const [more, setMore] = useState(false);
  const [sourceMode, setSourceMode] = useState<"visual" | "source" | "split">(
    "visual",
  );
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(
    null,
  );
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const draggedSelection = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };
  const closeHover = () => {
    clearHoverTimers();
    setHovered(null);
  };
  const leaveHover = () => {
    clearHoverTimers();
    leaveTimer.current = setTimeout(() => setHovered(null), 180);
  };
  const showHover = (
    element: HTMLElement,
    clientY?: number,
    immediate = false,
  ) => {
    clearHoverTimers();
    const rect =
      Array.from(element.getClientRects()).find(
        (r) => clientY !== undefined && r.top <= clientY && r.bottom >= clientY,
      ) || element.getBoundingClientRect();
    const show = () => setHovered({ id: element.dataset.commentId!, rect });
    if (immediate) show();
    else hoverTimer.current = setTimeout(show, 200);
  };
  const visual = useRef<HTMLDivElement>(null);
  const [editTick, tick] = useState(0);
  const dirty = useRef(false);
  const draftAvailable = useRef(true);
  const lastSaved = useRef(JSON.stringify(chapter.content));
  const chapterId = chapter.id;
  const baseRevision = useRef(chapter.revision);
  const saving = useRef(Promise.resolve());
  const saveFailure = useRef<unknown>(null);
  const statusLocked = useRef(false);
  const [statusLock, setStatusLock] = useState(false);
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
                      (c) =>
                        c.status === "open" || c.id === focusCommentRef.current,
                    )) {
                      const resolved = resolveAnchor(json, c);
                      for (const range of resolved.ranges) {
                        state.doc.descendants((node, pos) => {
                          if (
                            node.attrs.id !== range.blockId ||
                            !node.isTextblock
                          )
                            return;
                          let textOffset = 0;
                          node.descendants((child, childPos) => {
                            if (!child.isText) return;
                            const length = child.text!.length;
                            const from =
                              c.anchor.scope === "paragraph"
                                ? 0
                                : Math.max(0, range.from - textOffset);
                            const to =
                              c.anchor.scope === "paragraph"
                                ? length
                                : Math.min(length, range.to - textOffset);
                            if (to > from)
                              decorations.push(
                                Decoration.inline(
                                  pos + 1 + childPos + from,
                                  pos + 1 + childPos + to,
                                  {
                                    class:
                                      "comment-highlight" +
                                      (c.id === focusCommentRef.current
                                        ? " comment-target-highlight"
                                        : ""),
                                    "data-comment-id": c.id,
                                    role: "button",
                                    tabindex: "0",
                                    "aria-label":
                                      "Ver comentário " +
                                      commentReference(c.id),
                                    "aria-haspopup": "dialog",
                                  },
                                ),
                              );
                            textOffset += length;
                          });
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
      editable: !chapter.latexWarnings?.length,
      content: chapter.content,
      editorProps: {
        handleDOMEvents: {
          pointerover(_view, event) {
            const e = event as PointerEvent;
            const target = (e.target as Element).closest<HTMLElement>(
              "[data-comment-id]",
            );
            if (
              target &&
              !e.buttons &&
              window.getSelection()?.isCollapsed !== false
            )
              showHover(target, e.clientY);
            return false;
          },
          pointerout(_view, event) {
            const e = event as PointerEvent;
            const target = (e.target as Element).closest<HTMLElement>(
              "[data-comment-id]",
            );
            if (
              target &&
              !(
                e.relatedTarget instanceof Element &&
                e.relatedTarget
                  .closest("[data-comment-id]")
                  ?.getAttribute("data-comment-id") === target.dataset.commentId
              )
            )
              leaveHover();
            return false;
          },
          pointerdown(_view, event) {
            const e = event as PointerEvent;
            pointerStart.current = { x: e.clientX, y: e.clientY };
            draggedSelection.current = false;
            closeHover();
            return false;
          },
          pointermove(_view, event) {
            const e = event as PointerEvent;
            if (
              e.buttons &&
              pointerStart.current &&
              Math.hypot(
                e.clientX - pointerStart.current.x,
                e.clientY - pointerStart.current.y,
              ) > 4
            )
              draggedSelection.current = true;
            return false;
          },
          focusin(_view, event) {
            const target = (event.target as Element).closest<HTMLElement>(
              "[data-comment-id]",
            );
            if (target) showHover(target, undefined, true);
            return false;
          },
          focusout() {
            leaveHover();
            return false;
          },
          keydown(_view, event) {
            const e = event as KeyboardEvent;
            const target = (e.target as Element).closest<HTMLElement>(
              "[data-comment-id]",
            );
            if (e.key === "Escape") closeHover();
            if (
              target &&
              document.activeElement === target &&
              (e.key === "Enter" || e.key === " ")
            ) {
              e.preventDefault();
              closeHover();
              callbacks.current.onOpenComment(target.dataset.commentId!);
              return true;
            }
            return false;
          },
        },
        attributes: {
          "aria-label": "Conteúdo do capítulo",
          tabindex: "0",
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
            if (draggedSelection.current) return false;
            closeHover();
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
        if (!editor.isEditable) return;
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
        timer.current = setTimeout(() => { timer.current = null; void persist(editor.getJSON()).catch(() => {}); }, 800);
      },
    },
    [chapterId],
  );
  async function persist(content: Doc) {
    saving.current = saving.current
      .catch(() => {})
      .then(async () => {
        try {
          if (saveFailure.current) throw saveFailure.current;
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
        } catch (error) {
          saveFailure.current = error;
          setState(
            draftAvailable.current
              ? "Falha ao salvar · rascunho preservado"
              : "Falha ao salvar · mantenha esta janela aberta",
          );
          throw error;
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
      editor.setEditable(!statusLocked.current && !chapter.latexWarnings?.length, false);
      baseRevision.current = chapter.revision;
    }
    editor?.view.dispatch(editor.state.tr.setMeta("comments", true));
  }, [chapter.content, chapter.revision, comments, editor]);
  useEffect(() => {
    if (!editor) return;
    const controller = {
      async flush() {
        statusLocked.current = true;
        setStatusLock(true);
        editor.setEditable(false, false);
        const pending = timer.current !== null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        await saving.current;
        if (saveFailure.current) throw saveFailure.current;
        if (dirty.current && pending) await persist(editor.getJSON());
        if (dirty.current) throw new Error("O documento ainda não foi salvo. Preserve o rascunho antes de alterar o status.");
      },
      release() {
        statusLocked.current = false;
        setStatusLock(false);
        editor.setEditable(!chapter.latexWarnings?.length, false);
      },
    };
    saveController.current = controller;
    return () => { if (saveController.current === controller) saveController.current = null; };
  }, [editor, chapter.latexWarnings, saveController]);
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
  useEffect(() => {
    // Explicit navigation reveals the visual document; simply switching to code
    // afterwards must remain possible even while a comment is selected.
    if (focusCommentId && sourceModeRef.current === "source")
      setSourceMode("visual");
  }, [focusCommentId, focusRequest]);
  useEffect(() => {
    if (!editor) return;
    const body = visual.current;
    const pane = sourceMode === "split" ? body?.parentElement : body;
    if (!body || !pane) return;
    const overlay = body.closest(".document-layout")?.querySelector<HTMLElement>(".animated-comments");
    let frame = 0,
      last = "";
    let observedRoot: HTMLElement | null = null;
    const measure = () => {
      frame = 0;
      const ids: string[] = [];
      const currentRoot = body.querySelector<HTMLElement>(".academic-editor");
      if (currentRoot && currentRoot !== observedRoot) {
        if (observedRoot) resize.unobserve(observedRoot);
        resize.observe(currentRoot);
        observedRoot = currentRoot;
      }
      if (sourceMode !== "source" && body.getClientRects().length) {
        const area = pane.getBoundingClientRect(),
          column = body.getBoundingClientRect();
        const viewport = {
          top: Math.max(0, area.top, column.top),
          bottom: Math.min(innerHeight, area.bottom, column.bottom),
          left: Math.max(0, area.left, column.left),
          right: Math.min(innerWidth, area.right, column.right),
        };
        // On narrow windows the comments panel covers the document rather than
        // resizing it. Covered text is not a visible destination.
        if (overlay?.dataset.open === "true" && getComputedStyle(overlay).position === "absolute") {
          const layout = overlay.parentElement!.getBoundingClientRect();
          viewport.right = Math.min(viewport.right, layout.right - overlay.offsetWidth);
        }
        const anchors = new Map<string, DOMRect[]>();
        for (const mark of body.querySelectorAll<HTMLElement>(
          "[data-comment-id]",
        )) {
          const id = mark.dataset.commentId!;
          anchors.set(id, [...(anchors.get(id) || []), ...mark.getClientRects()]);
        }
        for (const [id, lines] of anchors)
          if (isCommentAnchorVisible(lines, viewport)) ids.push(id);
      }
      const key = JSON.stringify(ids.sort());
      if (key !== last) {
        last = key;
        onVisibleCommentsChange({ chapterId, ids });
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(pane);
    resize.observe(body);
    const changes = new MutationObserver(schedule);
    changes.observe(body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "data-comment-id"],
    });
    if (overlay) changes.observe(overlay, { attributes: true, attributeFilter: ["data-open", "class"] });
    pane.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      changes.disconnect();
      pane.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      onVisibleCommentsChange({ chapterId, ids: [] });
    };
  }, [editor, chapterId, sourceMode, onVisibleCommentsChange]);
  useEffect(() => {
    if (!editor || !focusCommentId) return;
    editor.view.dispatch(editor.state.tr.setMeta("comments", true));
    const pane =
      sourceMode === "split" ? visual.current?.parentElement : visual.current;
    if (!pane) return;
    const reveal = () => {
      const target = visual.current?.querySelector<HTMLElement>(
        ".comment-target-highlight",
      );
      if (!target) return;
      const boxes = [
        ...visual.current!.querySelectorAll<HTMLElement>(
          ".comment-target-highlight",
        ),
      ].map((mark) => mark.getBoundingClientRect());
      const excerptHeight =
        Math.max(...boxes.map((box) => box.bottom)) -
        Math.min(...boxes.map((box) => box.top));
      const offset =
        excerptHeight <= pane.clientHeight
          ? Math.min(
              pane.clientHeight * 0.25,
              Math.max(0, pane.clientHeight - excerptHeight - 8),
            )
          : pane.clientHeight * 0.25;
      const top =
        target.getBoundingClientRect().top -
        pane.getBoundingClientRect().top +
        pane.scrollTop;
      pane.scrollTo({
        top: Math.max(0, top - offset),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    };
    reveal();
    const revealFrame = requestAnimationFrame(reveal);
    editor.on("create", reveal);
    const panel = pane
      .closest(".document-layout")
      ?.querySelector<HTMLElement>(".animated-comments");
    const afterTransition = (event: TransitionEvent) => {
      if (
        event.target === panel &&
        panel?.dataset.open === "true" &&
        ["width", "transform"].includes(event.propertyName)
      )
        reveal();
    };
    panel?.addEventListener("transitionend", afterTransition);
    return () => {
      cancelAnimationFrame(revealFrame);
      editor.off("create", reveal);
      panel?.removeEventListener("transitionend", afterTransition);
    };
  }, [focusCommentId, focusRequest, editor, sourceMode]);
  useEffect(() => {
    const pane =
      sourceMode === "split" ? visual.current?.parentElement : visual.current;
    pane?.addEventListener("scroll", closeHover, { passive: true });
    return () => {
      pane?.removeEventListener("scroll", closeHover);
      clearHoverTimers();
    };
  }, [editor, sourceMode]);
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
    <div style={{ display: "contents" }} inert={statusLock}>
      {hovered && comments.find((c) => c.id === hovered.id) && (
        <CommentHover
          comment={comments.find((c) => c.id === hovered.id)!}
          rect={hovered.rect}
          onClose={closeHover}
          onEnter={clearHoverTimers}
          onLeave={leaveHover}
          onOpen={() => {
            closeHover();
            onOpenComment(hovered.id);
          }}
        />
      )}
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
        {editor.isEditable && (
          <>
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
          </>
        )}
        <button className="selection-comment" onClick={addComment}>
          <MessageCirclePlus size={15} />
          Comentar
        </button>
      </BubbleMenu>
      <div className="document-meta">
        <span>Documento / {chapter.title}</span>
        <div className="document-meta-actions">
          <div
            className="document-view-switch"
            role="group"
            aria-label="Visualização do documento"
          >
            {(
              [
                ["visual", "Visual"],
                ["source", "Código LaTeX"],
                ["split", "Lado a lado"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={sourceMode === mode}
                onClick={() => setSourceMode(mode)}
              >
                {mode === "source" && <Code2 size={13} />} {label}
              </button>
            ))}
          </div>
          <span className={state.startsWith("Falha") ? "error-text" : "saved"}>
            {state === "Salvo" ? <Check size={14} /> : null}
            {state}
          </span>
        </div>
      </div>
      <div
        className="editor-toolbar"
        hidden={sourceMode === "source" || !!chapter.latexWarnings?.length}
      >
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
        </div>
      </div>
      <div
        className={
          "document-reading-layout" +
          (sourceMode !== "visual" ? " source-open" : "") +
          (sourceMode === "source" ? " source-only" : "") +
          (sourceMode === "split" ? " source-aligned" : "")
        }
      >
        <div
          className="document-body"
          ref={visual}
          hidden={sourceMode === "source"}
        >
          {!(
            chapter.content.content?.[0]?.type === "heading" &&
            plain(chapter.content.content[0]).trim() === chapter.title.trim()
          ) && <h1 className="chapter-title">{chapter.title}</h1>}
          {!!chapter.latexWarnings?.length && (
            <p className="latex-projection-notice">
              Este capítulo contém comandos preservados no fonte.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => setSourceMode("source")}
              >
                Ver código LaTeX
              </button>
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
        {sourceMode !== "visual" && (
          <Suspense
            fallback={
              <p className="latex-source-message">Abrindo código LaTeX…</p>
            }
          >
            {sourceMode === "split" ? (
              <AlignedLatexSource
                chapter={chapter}
                content={editor.getJSON() as Doc}
                visual={visual}
                onOriginal={() => setSourceMode("source")}
              />
            ) : (
              <LatexSource
                chapter={chapter}
                onClose={() => setSourceMode("visual")}
              />
            )}
          </Suspense>
        )}
      </div>
      <div className="document-footer">
        {editor.getText().split(/\s+/).filter(Boolean).length} palavras{" "}
        <span>Conteúdo acadêmico · planejamento guardado separadamente</span>
      </div>
    </div>
  );
}
