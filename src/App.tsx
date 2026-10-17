import { ChapterNavigation } from "./components/ChapterNavigation";
import { ChapterStatus } from "./components/ChapterStatus";
import { ChapterCreate } from "./components/ChapterCreate";
import { NavigationWorkspace } from "./components/NavigationWorkspace";
import { HeaderSearch } from "./components/HeaderSearch";
import { Select, SelectOption } from "./components/Select";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  Sun,
  Moon,
  BookOpen,
  Settings as SettingsIcon,
  LayoutDashboard,
  NotebookPen,
  MessageSquare,
  History,
  Plus,
  FileText,
  Library,
  ChevronDown,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Check,
  ClipboardList,
  X,
} from "lucide-react";
import { request, action } from "./api";
import type { State, Doc, Chapter, Reference } from "../server/types";
import { plain } from "../server/types";
import type { SelectionAnchor } from "./components/Editor";
const DocumentEditor = lazy(() =>
  import("./components/Editor").then((m) => ({ default: m.DocumentEditor })),
);
import {
  Modal,
  SidePanel,
  ContextPopover,
  Field,
  Empty,
  type AnchorRect,
} from "./components/Primitives";
import { CommentSidebar } from "./components/CommentSidebar";
import { CommentsPanel, ProposalDetail } from "./components/Review";
import {
  Notebook,
  References,
  ReferenceDetails,
  Overview,
} from "./components/Collections";
import { VersionHistory } from "./components/History";
import { Settings, Welcome } from "./components/Settings";
export default function App() {
  const [state, setState] = useState<State | null>(null),
    [page, setPage] = useState("document"),
    [chapterId, setChapterId] = useState(""),
    [modal, setModal] = useState(""),
    [error, setError] = useState(""),
    [theme, setTheme] = useState(
      localStorage.getItem("laura-theme") || "system",
    ),
    [commentDraft, setCommentDraft] = useState<
      (SelectionAnchor & { chapterId?: string }) | null
    >(null),
    [commentOpen, setCommentOpen] = useState(false),
    [commentBody, setCommentBody] = useState(""),
    [commentDraftReady, setCommentDraftReady] = useState(false),
    [panelChapterId, setPanelChapterId] = useState(""),
    [panelRevision, setPanelRevision] = useState(0),
    [panelChapterRevision, setPanelChapterRevision] = useState(0),
    [commentId, setCommentId] = useState(""),
    [commentPanel, setCommentPanel] = useState(false),
    [reference, setReference] = useState<Reference | null>(null),
    [footnote, setFootnote] = useState(""),
    [popoverAnchor, setPopoverAnchor] = useState<AnchorRect | undefined>(),
    [settingsTab, setSettingsTab] = useState("general"),
    [referencePageId, setReferencePageId] = useState(""),
    [noteSearchId, setNoteSearchId] = useState(""),
    [noteCompose, setNoteCompose] = useState(false),
    [searchNavigation, setSearchNavigation] = useState(0),
    [insert, setInsert] = useState<{
      kind: string;
      fn: (v: any) => void;
    } | null>(null),
    [welcome, setWelcome] = useState(!localStorage.getItem("laura-welcome")),
    [dirty, setDirty] = useState(false),
    [recovery, setRecovery] = useState<any>(null);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme,
  );
  const stateRef = useRef<State | null>(null);
  const queue = useRef(Promise.resolve());
  const editorSave = useRef<{ flush: () => Promise<void>; release: () => void } | null>(null);
  async function refresh() {
    const s = await request<State>("state");
    if (s.revision < (stateRef.current?.revision || 0)) return;
    stateRef.current = s;
    setState(s);
    setChapterId((id) => id || s.chapters[0]?.id || "");
  }
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      setError(e.reason?.message || "Não foi possível concluir a operação.");
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const focus = () => {
      if (!dirty) void refresh().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [dirty]);
  useEffect(() => {
    localStorage.setItem("laura-theme", theme);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      setResolvedTheme(resolved);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (e) => {
      const update = JSON.parse(e.data);
      if (update.revision <= (stateRef.current?.revision || 0)) return;
      if (!dirty) void refresh().catch((e) => setError(e.message));
      else if (update.origin === "mcp")
        setError(
          "O ChatGPT atualizou o projeto. Seu rascunho está preservado; revise o conflito antes de aplicar mudanças.",
        );
    };
    return () => events.close();
  }, [dirty]);
  useEffect(() => {
    if (chapterId) {
      const draft = localStorage.getItem("laura-draft-" + chapterId);
      if (draft) setRecovery(JSON.parse(draft));
    }
  }, [chapterId]);
  useEffect(() => {
    if (!state?.id) return;
    try {
      const saved = localStorage.getItem("laura-comment-draft-" + state.id);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCommentDraft(parsed.draft);
        setCommentBody(parsed.body || "");
      }
    } catch {}
    setCommentDraftReady(true);
  }, [state?.id]);
  useEffect(() => {
    if (!state?.id || !commentDraftReady) return;
    try {
      if (commentDraft && commentBody.trim())
        localStorage.setItem(
          "laura-comment-draft-" + state.id,
          JSON.stringify({ draft: commentDraft, body: commentBody }),
        );
      else localStorage.removeItem("laura-comment-draft-" + state.id);
    } catch {}
  }, [state?.id, commentDraftReady, commentDraft, commentBody]);
  function mutate(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<any> {
    const run = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          const r = await action(name, {
            expectedRevision: stateRef.current!.revision,
            ...args,
          });
          await refresh();
          return r;
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      });
    queue.current = run.then(() => {});
    return run;
  }
  function navigate(id: string, targetCommentId?: string) {
    if (dirty) {
      setError(
        "Aguarde o salvamento antes de mudar de capítulo. Se houver falha, seu rascunho está preservado neste navegador.",
      );
      return;
    }
    setCommentOpen(false);
    setChapterId(id);
    setPage("document");
    setCommentPanel(Boolean(targetCommentId));
    setCommentId(targetCommentId || "");
    if (targetCommentId) setSearchNavigation(n => n + 1);
  }
  function goPage(p: string) {
    if (dirty) {
      setError("Aguarde o salvamento antes de navegar.");
      return;
    }
    setNoteCompose(false);
    setCommentOpen(false);
    setPage(p);
    setCommentPanel(false);
  }
  if (!state)
    return (
      <main className="loading">
        <BookOpen size={28} />
        <p>{error || "Abrindo seu espaço…"}</p>
      </main>
    );
  const chapter = state.chapters.find((c) => c.id === chapterId),
    chapterComments = state.comments.filter((c) => c.chapterId === chapterId);
  const panelChapter = state.chapters.find((c) => c.id === panelChapterId);
  const closeWelcome = () => {
    localStorage.setItem("laura-welcome", "1");
    setWelcome(false);
  };
  const nav = (label: string, p: string, Icon: any, count?: number) => (
    <button
      className={"nav-item " + (page === p ? "selected" : "")}
      onClick={() => goPage(p)}
    >
      <Icon size={20} />
      <span>{label}</span>
      {!!count && <span className="nav-count">{count}</span>}
    </button>
  );
  return (
    <div
      className={
        "app-shell " +
        (["plan", "metadata"].includes(modal) || recovery
          ? " has-side-sheet"
          : "")
      }
    >
      <header className="app-header">
        <div className="brand">
          <span>Laura Workspace</span>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            aria-label={
              resolvedTheme === "dark"
                ? "Ativar modo claro"
                : "Ativar modo escuro"
            }
            title={
              resolvedTheme === "dark"
                ? "Ativar modo claro"
                : "Ativar modo escuro"
            }
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? <Sun key="sun" /> : <Moon key="moon" />}
          </button>
          <HeaderSearch
            state={state}
            onSelect={(result) => {
              if (dirty) {
                setError("Aguarde o salvamento antes de abrir o resultado.");
                return;
              }
              setSearchNavigation((n) => n + 1);
              if (result.kind === "chapter") navigate(result.id);
              else if (result.kind === "comment") {
                navigate(result.chapterId!);
                setCommentId(result.id);
                setCommentPanel(true);
              } else if (result.kind === "note") {
                setNoteSearchId(result.id);
                goPage("notes");
              } else {
                setReferencePageId(result.id);
                goPage("references");
              }
            }}
          />
          <button
            aria-label="Configurações"
            title="Configurações"
            onClick={() => goPage("settings")}
          >
            <SettingsIcon size={23} />
          </button>
        </div>
      </header>
      <NavigationWorkspace navigation={<>
          <nav>
            {nav("Visão geral", "overview", LayoutDashboard)}
            {nav("Caderno de ideias", "notes", NotebookPen)}
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <span>Capítulos</span>
              <button
                aria-label="Criar capítulo"
                onClick={() => goPage("new-chapter")}
              >
                <Plus size={17} />
              </button>
            </div>
            {state.chapters.length ? <ChapterNavigation chapters={state.chapters} revision={state.revision} selectedId={page === "document" ? chapterId : ""} onNavigate={navigate} onReorder={(ids, expectedRevision) => mutate("reorder_chapters", {ids,expectedRevision})}/> : <button className="nav-empty" onClick={() => goPage("new-chapter")}>Adicionar primeiro capítulo</button>}
            <div className="sidebar-divider" />
            {nav(
              "Comentários",
              "comments",
              MessageSquare,
              state.comments.filter((c) => c.status === "open").length,
            )}
            {nav("Histórico", "history", History)}
            {nav("Referências", "references", Library)}
            {state.proposals.some(
              (p) => p.status === "pending" || p.status === "approved",
            ) &&
              nav(
                "Alterações propostas",
                "proposals",
                ClipboardList,
                state.proposals.filter(
                  (p) => p.status === "pending" || p.status === "approved",
                ).length,
              )}
          </nav>
          <div className="sidebar-footer">
            <span className="local-dot" />
            Neste computador
          </div>
        </>}>
        <main className="main-content">
          {page === "new-chapter" && <ChapterCreate state={state} mutate={mutate} onCreated={navigate} onCancel={() => goPage(chapter ? "document" : "overview")}/>}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {localStorage.getItem("laura-draft-" + chapterId) && (
                <button
                  onClick={async () => {
                    await refresh();
                    setRecovery(
                      JSON.parse(
                        localStorage.getItem("laura-draft-" + chapterId)!,
                      ),
                    );
                  }}
                >
                  Rever rascunho
                </button>
              )}
              <button aria-label="Fechar aviso" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "document" &&
            (chapter ? (
              <div
                className={
                  "document-layout " + (commentPanel ? "with-comments" : "")
                }
              >
                <section className="document">
                  <Suspense
                    fallback={<p className="notice">Abrindo documento…</p>}
                  >
                    <DocumentEditor
                      key={chapter.id}
                      chapter={chapter}
                      saveController={editorSave}
                      comments={chapterComments}
                      focusCommentId={commentId}
                      focusRequest={searchNavigation}
                      onSave={(content, baseRevision) =>
                        mutate("update_chapter", {
                          chapterId: chapter.id,
                          chapterRevision: baseRevision,
                          content,
                        }).then((r) => r.result.revision)
                      }
                      dirtyChanged={setDirty}
                      onComment={(draft) => {
                        setCommentPanel(false);
                        if (!commentBody.trim())
                          setCommentDraft({ ...draft, chapterId: chapter.id });
                        setCommentOpen(true);
                      }}
                      onOpenComment={(id) => {
                        setCommentId(id);
                        setCommentPanel(true);
                      }}
                      onCitation={(key, rect) => {
                        setPopoverAnchor(rect);
                        const r = state.references.find((r) => r.key === key);
                        if (r) setReference(r);
                        else {
                          setError("Citação sem entrada bibliográfica: " + key);
                        }
                      }}
                      onFootnote={(text, rect) => {
                        setPopoverAnchor(rect);
                        setFootnote(text);
                      }}
                      onCrossRef={(id) => {
                        if (state.chapters.some((c) => c.id === id)) {
                          navigate(id);
                          return;
                        }
                        const el = document.querySelector<HTMLElement>(
                          `[data-id="${CSS.escape(id)}"]`,
                        );
                        if (el) {
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          el.classList.add("cross-target");
                          setTimeout(
                            () => el.classList.remove("cross-target"),
                            2000,
                          );
                        } else
                          setError("Destino não localizado neste capítulo.");
                      }}
                      onInsert={(kind, fn) => {
                        setPopoverAnchor(
                          document
                            .querySelector(".editor-toolbar")
                            ?.getBoundingClientRect(),
                        );
                        setInsert({ kind, fn });
                      }}
                    />
                  </Suspense>
                  <div className="chapter-options">
                    <ChapterStatus key={chapter.id} chapter={chapter}
                      prepare={async () => {
                        if (!editorSave.current) throw new Error("Aguarde o documento abrir.");
                        await editorSave.current.flush();
                        await queue.current;
                        const current = stateRef.current!;
                        return { state: current, chapter: current.chapters.find(c => c.id === chapter.id)! };
                      }}
                      release={() => editorSave.current?.release()}
                      apply={(snapshot, status, acknowledged) => mutate("update_chapter", {
                        expectedRevision: snapshot.state.revision,
                        chapterId: snapshot.chapter.id,
                        chapterRevision: snapshot.chapter.revision,
                        status,
                        ...(acknowledged ? { acknowledgeOpenComments: true } : {}),
                      })}
                    />
                    <button
                      onClick={() => {
                        setPanelChapterId(chapter.id);
                        setPanelRevision(state.revision);
                        setPanelChapterRevision(chapter.revision);
                        setModal("plan");
                      }}
                    >
                      <ClipboardList size={15} /> Planejamento
                    </button>
                    <button
                      onClick={() => {
                        setCommentId("");
                        setCommentPanel(!commentPanel);
                      }}
                    >
                      <MessageSquare size={15} />{" "}
                      {
                        chapterComments.filter((c) => c.status === "open")
                          .length
                      }{" "}
                      comentários
                    </button>
                    <button
                      aria-label="Organizar capítulo"
                      onClick={() => {
                        setPanelChapterId(chapter.id);
                        setPanelRevision(state.revision);
                        setPanelChapterRevision(chapter.revision);
                        setModal("metadata");
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </section>
                <CommentSidebar open={commentPanel}>
                  <button
                    className="context-close"
                    aria-label="Recolher comentários"
                    onClick={() => setCommentPanel(false)}
                  >
                    <X size={18} />
                  </button>
                  <CommentsPanel
                    key={chapter.id + commentId + searchNavigation}
                    state={state}
                    mutate={mutate}
                    chapterId={chapter.id}
                    selectedId={commentId}
                    onNavigate={navigate}
                  />
                </CommentSidebar>
              </div>
            ) : (
              <Empty
                title="Seu trabalho começa aqui"
                description="Crie a estrutura ou importe seu projeto LaTeX. O texto pode chegar depois, com o ChatGPT."
              >
                <button className="primary" onClick={() => goPage("new-chapter")}>
                  <Plus size={16} /> Criar capítulo
                </button>
                <button onClick={() => goPage("settings")}>
                  Importar projeto
                </button>
              </Empty>
            ))}
          {page === "overview" && (
            <Overview
              state={state}
              onNavigate={navigate}
              onPage={goPage}
              onCreateNote={() => {
                if (dirty) {
                  setError("Aguarde o salvamento antes de criar uma ideia.");
                  return;
                }
                goPage("notes");
                setNoteSearchId("");
                setNoteCompose(true);
                setSearchNavigation((n) => n + 1);
              }}
            />
          )}{" "}
          {page === "notes" && (
            <Notebook
              key={noteSearchId + searchNavigation}
              initialNoteId={noteSearchId}
              startNew={noteCompose}
              state={state}
              mutate={mutate}
            />
          )}{" "}
          {page === "comments" && (
            <CommentsPanel
              state={state}
              mutate={mutate}
              onNavigate={navigate}
            />
          )}{" "}
          {page === "history" && (
            <VersionHistory state={state} mutate={mutate} />
          )}{" "}
          {page === "references" && (
            <References
              key={referencePageId + searchNavigation}
              state={state}
              mutate={mutate}
              onNavigate={navigate}
              refresh={refresh}
              initialReferenceId={referencePageId}
              onConnect={() => {
                setSettingsTab("chatgpt");
                goPage("settings");
              }}
            />
          )}{" "}
          {page === "settings" && (
            <section className="collection settings-page">
              <div className="page-heading">
                <div>
                  <h1>Configurações</h1>
                  <p>Seu projeto, seus arquivos e a conexão com o ChatGPT.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => goPage("document")}
                >
                  Voltar ao documento
                </button>
              </div>
              <Settings
                state={state}
                mutate={mutate}
                refresh={refresh}
                onTheme={setTheme}
                theme={theme}
                initialTab={settingsTab}
              />
            </section>
          )}
          {page === "proposals" && (
            <section className="collection">
              <div className="page-heading">
                <div>
                  <h1>Alterações propostas</h1>
                  <p>Revisar, aprovar e aplicar são decisões separadas.</p>
                </div>
              </div>
              {state.proposals.length ? (
                state.proposals
                  .slice()
                  .reverse()
                  .map((p) => (
                    <ProposalDetail key={p.id} p={p} mutate={mutate} />
                  ))
              ) : (
                <Empty
                  title="Nenhuma alteração proposta"
                  description="As propostas do ChatGPT aparecerão aqui para sua revisão."
                />
              )}
            </section>
          )}
        </main>
      </NavigationWorkspace>
      {welcome && (
        <Modal title="Bem-vinda, Laura" onClose={closeWelcome}>
          <Welcome
            state={state}
            mutate={mutate}
            onImport={() => {
              closeWelcome();
              goPage("settings");
            }}
            onClose={closeWelcome}
          />
        </Modal>
      )}
      {(modal === "metadata" && panelChapter) && (
        <SidePanel
          title="Organizar capítulo"
          onClose={() => setModal("")}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (panelChapter)
                await mutate("update_chapter", {
                  chapterId: panelChapter!.id,
                  chapterRevision: panelChapterRevision,
                  expectedRevision: panelRevision,
                  title: f.get("title"),
                });
              setModal("");
            }}
          >
            <Field label="Título">
              <input
                required
                autoFocus
                name="title"
                defaultValue={modal === "metadata" ? panelChapter?.title : ""}
              />
            </Field>
            <div className="actions">
              <button className="primary">
                Guardar título
              </button>
            </div>
          </form>
          {modal === "metadata" && panelChapter && (
            <div className="actions">
              {[-1, 1].map((direction) => (
                <button
                  key={direction}
                  onClick={async () => {
                    const ids = state.chapters.map((c) => c.id),
                      i = ids.indexOf(panelChapter!.id),
                      j = i + direction;
                    if (j < 0 || j >= ids.length) return;
                    [ids[i], ids[j]] = [ids[j], ids[i]];
                    await mutate("reorder_chapters", { ids });
                  }}
                >
                  {direction < 0 ? (
                    <ArrowUp size={15} />
                  ) : (
                    <ArrowDown size={15} />
                  )}
                  Mover {direction < 0 ? "para cima" : "para baixo"}
                </button>
              ))}
            </div>
          )}
        </SidePanel>
      )}
      {modal === "plan" && panelChapter && (
        <SidePanel
          title={"Planejamento · " + panelChapter!.title}
          onClose={() => setModal("")}
        >
          <p className="notice">
            Objetivos, dúvidas e decisões. Este espaço não é exportado para o
            texto acadêmico.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate("update_chapter_plan", {
                expectedRevision: panelRevision,
                chapterId: panelChapter!.id,
                plan: new FormData(e.currentTarget).get("plan"),
              });
              setModal("");
            }}
          >
            <textarea
              aria-label="Planejamento do capítulo"
              name="plan"
              rows={10}
              defaultValue={panelChapter!.plan}
            />
            <div className="actions">
              <button className="primary">Guardar planejamento</button>
            </div>
          </form>
        </SidePanel>
      )}
      {commentDraft && commentOpen && (
        <ContextPopover
          anchor={commentDraft.rect}
          dismissOnOutside={false}
          title={
            "Comentar · " +
            (state.chapters.find((c) => c.id === commentDraft.chapterId)
              ?.title || "capítulo")
          }
          onClose={() => setCommentOpen(false)}
        >
          {commentDraft.quote && (
            <blockquote className="selection-quote">
              {commentDraft.quote}
            </blockquote>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await mutate("create_comment", {
                chapterId: commentDraft.chapterId || chapterId,
                quote: commentDraft.quote,
                body: new FormData(e.currentTarget).get("body"),
                anchor: {
                  ...commentDraft.anchor,
                  scope: new FormData(e.currentTarget).get("scope"),
                },
              });
              setCommentDraft(null);
              setCommentBody("");
              setCommentOpen(false);
              setCommentId(r.result.id);
              if (page === "document" && chapterId === commentDraft.chapterId)
                setCommentPanel(true);
              else goPage("comments");
            }}
          >
            <Field label="Escopo do comentário">
              <Select name="scope" defaultValue={commentDraft.anchor.scope}>
                <SelectOption value="selection">
                  Trecho selecionado
                </SelectOption>
                <SelectOption value="paragraph">Parágrafo</SelectOption>
                <SelectOption value="section">Seção</SelectOption>
                <SelectOption value="chapter">Capítulo inteiro</SelectOption>
              </Select>
            </Field>
            <textarea
              autoFocus
              aria-label="Seu comentário"
              name="body"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={4}
              required
              placeholder="O que você gostaria de orientar ou revisar?"
            />
            <div className="actions">
              <button className="primary">Comentar</button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCommentDraft(null);
                  setCommentBody("");
                  setCommentOpen(false);
                }}
              >
                Descartar rascunho
              </button>
            </div>
          </form>
        </ContextPopover>
      )}
      {commentDraft && !commentOpen && commentBody.trim() && (
        <button
          className="comment-draft-resume"
          onClick={() => setCommentOpen(true)}
        >
          <MessageSquare size={14} />
          Retomar comentário
        </button>
      )}
      {reference && (
        <ContextPopover
          title="Fonte citada"
          anchor={popoverAnchor}
          onClose={() => setReference(null)}
        >
          <div className="citation-preview">
            <h3>{reference.title}</h3>
            <p>
              {reference.authors}
              {reference.year ? " · " + reference.year : ""}
            </p>
            {reference.publication && <small>{reference.publication}</small>}
            {reference.note && <p className="subtle">{reference.note}</p>}
            <div className="actions">
              <button
                onClick={() => {
                  setReferencePageId(reference.id);
                  setReference(null);
                  goPage("references");
                }}
              >
                Ver na bibliografia
              </button>
              {reference.url && (
                <a href={reference.url} target="_blank" rel="noreferrer">
                  Abrir fonte
                </a>
              )}
            </div>
          </div>
        </ContextPopover>
      )}
      {footnote && (
        <ContextPopover
          anchor={popoverAnchor}
          title="Nota de rodapé"
          onClose={() => setFootnote("")}
        >
          <p className="footnote-content">{footnote}</p>
          <button onClick={() => setFootnote("")}>Voltar ao texto</button>
        </ContextPopover>
      )}
      {insert && (
        <ContextPopover
          anchor={popoverAnchor}
          title={
            {
              citation: "Inserir citação",
              footnote: "Nota de rodapé",
              math: "Inserir equação",
              image: "Inserir figura local",
              crossReference: "Referência cruzada",
            }[insert.kind] || "Inserir"
          }
          onClose={() => setInsert(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (insert.kind === "citation") {
                const r = state.references.find((r) => r.key === f.get("key"));
                insert.fn({
                  key: f.get("key"),
                  label: r
                    ? `(${r.authors || r.key}${r.year ? ", " + r.year : ""})`
                    : String(f.get("key")),
                });
              } else if (insert.kind === "crossReference")
                insert.fn({
                  targetId: f.get("targetId"),
                  label: f.get("label"),
                });
              else if (insert.kind !== "image")
                insert.fn({ text: f.get("text") });
              setInsert(null);
            }}
          >
            {insert.kind === "citation" ? (
              <Field label="Referência cadastrada">
                <Select name="key" required>
                  {state.references.map((r) => (
                    <SelectOption key={r.id} value={r.key}>
                      {r.key} · {r.title}
                    </SelectOption>
                  ))}
                </Select>
              </Field>
            ) : insert.kind === "image" ? (
              <>
                <Field label="Arquivo PNG ou JPEG">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 4 * 1024 * 1024) {
                        setError("Use uma imagem menor que 4 MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        insert.fn({
                          src: reader.result,
                          alt: file.name,
                          title: file.name,
                        });
                        setInsert(null);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </Field>
                <p className="subtle">
                  A imagem fica armazenada localmente com o documento. Adicione
                  a legenda no parágrafo seguinte.
                </p>
              </>
            ) : insert.kind === "crossReference" ? (
              <>
                <Field label="Destino no trabalho">
                  <Select name="targetId" required>
                    {state.chapters.map((c) => (
                      <SelectOption key={c.id} value={c.id}>
                        {c.title}
                      </SelectOption>
                    ))}
                    {chapter &&
                      crossReferenceTargets(chapter.content).map((t) => (
                        <SelectOption key={t.id} value={t.id}>
                          {t.label}
                        </SelectOption>
                      ))}
                  </Select>
                </Field>
                <Field label="Texto do link">
                  <input required name="label" placeholder="Ver seção 2" />
                </Field>
              </>
            ) : (
              <Field
                label={
                  insert.kind === "math" ? "Expressão LaTeX" : "Texto da nota"
                }
              >
                <textarea name="text" required rows={3} />
              </Field>
            )}
            {insert.kind !== "image" && (
              <div className="actions">
                <button
                  className="primary"
                  disabled={
                    insert.kind === "citation" && !state.references.length
                  }
                >
                  Inserir
                </button>
              </div>
            )}
          </form>
        </ContextPopover>
      )}
      {recovery && chapter && (
        <SidePanel
          title="Rascunho encontrado"
          onClose={() => setRecovery(null)}
        >
          <p>
            Existe uma edição que ainda não foi confirmada como salva. O texto
            permanece preservado neste navegador.
          </p>
          <pre className="draft-preview">{plain(recovery.content)}</pre>
          <div className="actions">
            <button
              className="primary"
              onClick={async () => {
                await mutate("propose_edit", {
                  chapterId: chapter.id,
                  chapterRevision: chapter.revision,
                  after: recovery.content,
                  reason: "Recuperação do rascunho local de " + recovery.at,
                });
                localStorage.removeItem("laura-draft-" + chapter.id);
                setRecovery(null);
                setDirty(false);
                setPage("proposals");
              }}
            >
              Recuperar como proposta para revisão
            </button>
            <button onClick={() => setRecovery(null)}>Decidir depois</button>
          </div>
        </SidePanel>
      )}
    </div>
  );
}

function crossReferenceTargets(doc: Doc) {
  const targets: { id: string; label: string }[] = [];
  function visit(d: Doc) {
    if (d.attrs?.id && ["heading", "table", "image"].includes(d.type))
      targets.push({
        id: d.attrs.id,
        label:
          d.type === "heading"
            ? plain(d)
            : d.type === "image"
              ? "Figura: " + (d.attrs.title || d.attrs.alt || "sem legenda")
              : "Tabela " +
                (targets.filter((t) => t.label.startsWith("Tabela")).length +
                  1),
      });
    for (const c of d.content || []) visit(c);
  }
  visit(doc);
  return targets;
}
