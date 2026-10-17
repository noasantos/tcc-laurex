import "./notebook.css";
import "./reference-details.css";
import { Select, SelectOption } from "./Select";
import { useState, useRef, useEffect } from "react";
import {
  Plus,
  ArrowUpRight,
  Archive,
  Check,
  BookOpen,
  Lightbulb,
  ChevronLeft,
  Upload,
  Copy,
  CheckCheck,
  MoreHorizontal,
  Search,
  Pencil,
  FileText,
  Paperclip,
  LoaderCircle,
} from "lucide-react";
import { request } from "../api";
import type { State, Note, Reference } from "../../server/types";
import { plain } from "../../server/types";
import type { Mutate } from "./Review";
import { Empty, Field, date } from "./Primitives";
import { NoteComposer as NoteForm, categories } from "./NoteComposer";
export { categories } from "./NoteComposer";
export function Notebook({
  state,
  mutate,
  initialNoteId,
  startNew = false,
}: {
  state: State;
  mutate: Mutate;
  initialNoteId?: string;
  startNew?: boolean;
}) {
  const [edit, setEdit] = useState<Note | "new" | null>(
      startNew ? "new" : null,
    ),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (initialNoteId)
      document
        .getElementById("note-" + initialNoteId)
        ?.scrollIntoView({ block: "nearest" });
  }, [initialNoteId]);
  const notes = state.notes.filter(
    (n) =>
      n.state !== "Arquivada" &&
      (!filter || n.category === filter) &&
      JSON.stringify(n).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="collection">
      <div className="page-heading">
        <div>
          <h1>Caderno de ideias</h1>
          <p>Pensamentos e decisões, separados do texto acadêmico.</p>
        </div>
        {edit !== "new" && (
          <button onClick={() => setEdit("new")}>
            <Plus size={15} />
            Nova ideia
          </button>
        )}
      </div>
      {state.notes.some((n) => n.state !== "Arquivada") && edit !== "new" && (
        <div className="filters">
          <Select
            aria-label="Categoria das notas"
            value={filter}
            onValueChange={(value) => setFilter(value)}
          >
            <SelectOption value="">Todas as categorias</SelectOption>
            {categories.map((x) => (
              <SelectOption key={x}>{x}</SelectOption>
            ))}
          </Select>
          <input
            aria-label="Pesquisar notas"
            placeholder="Pesquisar ideias…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {edit === "new" && (
        <NoteForm
          note="new"
          projectRevision={state.revision}
          mutate={mutate}
          onCancel={() => setEdit(null)}
        />
      )}{" "}
      {!notes.length && edit !== "new" && (
        <div className="notebook-empty">
          <p>
            {state.notes.some((n) => n.state !== "Arquivada")
              ? "Nenhuma ideia corresponde à pesquisa."
              : "Seu caderno começa com uma ideia."}
          </p>
          <span>
            Guarde um pensamento ou peça ao ChatGPT para registrar algo da
            conversa aqui.
          </span>
        </div>
      )}
      <div className="notes-list">
        {notes.map((n) =>
          edit !== "new" && edit?.id === n.id ? (
            <NoteForm
              key={n.id}
              note={n}
              projectRevision={state.revision}
              mutate={mutate}
              onCancel={() => setEdit(null)}
            />
          ) : (
            <article
              key={n.id}
              id={"note-" + n.id}
              className={
                "note " + (initialNoteId === n.id ? "search-target" : "")
              }
            >
              <small>
                {n.category} · {date(n.updatedAt)} ·{" "}
                {n.origin === "mcp" ? "ChatGPT" : "Laura"}
              </small>
              <button className="note-title" onClick={() => setEdit(n)}>
                <h3>{n.title || n.content.slice(0, 65)}</h3>
              </button>
              <p>{n.content}</p>
              <div className="row-between">
                <Select
                  aria-label="Vincular nota ao capítulo"
                  value={n.chapterId || ""}
                  onValueChange={(value) =>
                    mutate("link_note_to_chapter", {
                      noteId: n.id,
                      chapterId: value || null,
                    })
                  }
                >
                  <SelectOption value="">Sem capítulo</SelectOption>
                  {state.chapters.map((c) => (
                    <SelectOption key={c.id} value={c.id}>
                      {c.title}
                    </SelectOption>
                  ))}
                </Select>
                <div className="actions">
                  {n.category === "Tarefa" && (
                    <button
                      aria-label="Concluir tarefa"
                      onClick={() =>
                        mutate("update_note", {
                          noteId: n.id,
                          state:
                            n.state === "Concluída" ? "Aberta" : "Concluída",
                        })
                      }
                    >
                      <Check size={14} />
                      {n.state}
                    </button>
                  )}
                  {n.chapterId && (
                    <button
                      onClick={async () => {
                        await mutate("create_comment", {
                          chapterId: n.chapterId,
                          body: n.content,
                        });
                        await mutate("update_note", {
                          noteId: n.id,
                          state: "Arquivada",
                        });
                      }}
                    >
                      Transformar em comentário
                    </button>
                  )}
                  <button
                    aria-label="Arquivar nota"
                    onClick={() =>
                      mutate("update_note", {
                        noteId: n.id,
                        state: "Arquivada",
                      })
                    }
                  >
                    <Archive size={14} />
                  </button>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
function referenceUsages(state: State, key: string) {
  return state.chapters.filter((c) => {
    let found = false;
    function visit(d: any) {
      if (
        d.type === "citation" &&
        String(d.attrs?.key || "")
          .split(",")
          .includes(key)
      )
        found = true;
      for (const n of d.content || []) visit(n);
    }
    visit(c.content);
    return found;
  });
}
export function ReferenceDetails({
  reference,
  state,
  onNavigate,
  onReturn,
  mutate,
  refresh,
}: {
  reference: Reference;
  state: State;
  onNavigate: (id: string) => void;
  onReturn?: () => void;
  mutate?: Mutate;
  refresh?: () => Promise<void>;
}) {
  const [pdfId, setPdfId] = useState(reference.localPdfId || ""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [uploading, setUploading] = useState(false),
    [attached, setAttached] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setPdfId(reference.localPdfId || ""), [reference.localPdfId]);
  const usages = referenceUsages(state, reference.key);
  if (editing && mutate)
    return (
      <div className="reference-detail-edit">
        <h2>Editar dados da fonte</h2>
        <p className="subtle">Título, autoria e informações da publicação.</p>
        <ReferenceForm
          initial={reference}
          projectRevision={state.revision}
          mutate={mutate}
          onDone={() => {
            setEditing(false);
            requestAnimationFrame(() => editButton.current?.focus());
          }}
          compact
        />
      </div>
    );
  return (
    <>
      <div className="reference-detail">
        <div className="reference-data-heading">
          <span>Dados bibliográficos</span>
          {mutate && (
            <button
              type="button"
              className="text-button"
              ref={editButton}
              onClick={() => setEditing(true)}
            >
              <Pencil size={13} aria-hidden="true" /> Editar dados
            </button>
          )}
        </div>
        <h2>{reference.title}</h2>
        <p>
          {reference.authors || "Autores ainda não informados"}
          {reference.year ? " · " + reference.year : ""}
        </p>
        {reference.publication && <p>{reference.publication}</p>}
        <div className="source-provenance">
          <span className="local-dot" />
          {reference.origin === "mcp"
            ? "Registrada pelo ChatGPT"
            : reference.origin === "ui"
              ? "Adicionada no workspace"
              : "Referência cadastrada"}
        </div>
        {(!reference.authors || !reference.year) && (
          <p className="subtle">
            Alguns metadados estão incompletos. O ChatGPT pode complementar esta
            fonte durante a conversa.
          </p>
        )}
        {reference.note && <p className="reference-note">{reference.note}</p>}
        <div className="actions">
          {reference.doi && (
            <a
              href={"https://doi.org/" + encodeURIComponent(reference.doi)}
              target="_blank"
              rel="noreferrer"
            >
              DOI <ArrowUpRight size={13} />
            </a>
          )}
          {reference.url && (
            <a href={reference.url} target="_blank" rel="noreferrer">
              Abrir fonte <ArrowUpRight size={13} />
            </a>
          )}
        </div>
        {(reference.evidenceUrl || reference.evidenceNote) && (
          <details className="source-evidence">
            <summary>Origem dos metadados</summary>
            {reference.evidenceNote && <p>{reference.evidenceNote}</p>}
            {reference.evidenceUrl && (
              <a href={reference.evidenceUrl} target="_blank" rel="noreferrer">
                Consultar evidência fornecida <ArrowUpRight size={12} />
              </a>
            )}
            <p className="subtle">
              Informações registradas pelo colaborador. O aplicativo não
              certifica o conteúdo da fonte.
            </p>
          </details>
        )}
      </div>
      <div className="reference-section-heading">Utilizada no trabalho</div>
      {usages.length ? (
        usages.map((c) => (
          <button
            key={c.id}
            className="list-link"
            onClick={() => onNavigate(c.id)}
          >
            <span>{c.title}</span>
            <ArrowUpRight className="list-link-trailing" size={14} />
          </button>
        ))
      ) : (
        <p className="subtle">Ainda não citada no texto.</p>
      )}
      <section
        className="reference-attachment"
        aria-labelledby={"pdf-heading-" + reference.id}
      >
        <h3 id={"pdf-heading-" + reference.id}>
          Arquivo da fonte <span>Opcional</span>
        </h3>
        <p>
          Guarde o PDF desta publicação para consultar depois, sem procurar o
          link.
        </p>
        <div className="reference-attachment-row">
          <FileText size={20} strokeWidth={1.5} aria-hidden="true" />
          {pdfId ? (
            <a href={"/api/sources/" + pdfId} target="_blank" rel="noreferrer">
              Abrir PDF <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          ) : (
            <span className="subtle">Nenhum PDF anexado</span>
          )}
          {mutate && refresh && (
            <>
              <button
                type="button"
                className="text-button"
                disabled={uploading}
                onClick={() => pdfInput.current?.click()}
              >
                {uploading ? (
                  <LoaderCircle
                    size={14}
                    className="reference-upload-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <Paperclip size={14} aria-hidden="true" />
                )}
                {uploading ? "Anexando…" : pdfId ? "Substituir" : "Anexar PDF"}
              </button>
              <input
                ref={pdfInput}
                hidden
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Selecionar PDF da fonte"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setError("");
                  setAttached(false);
                  if (file.size > 8 * 1024 * 1024) {
                    setError("Selecione um PDF de até 8 MB.");
                    return;
                  }
                  setUploading(true);
                  try {
                    const data = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () =>
                          resolve(String(reader.result).split(",")[1]);
                        reader.onerror = () =>
                          reject(
                            new Error(
                              "Não foi possível ler o PDF. Tente selecionar o arquivo novamente.",
                            ),
                          );
                        reader.readAsDataURL(file);
                      },
                    );
                    const r = await request("reference-pdf", {
                      expectedRevision: state.revision,
                      referenceId: reference.id,
                      name: file.name,
                      base64: data,
                    });
                    setPdfId(r.sourceId);
                    await refresh();
                    setAttached(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </>
          )}
        </div>
        <span className="reference-attachment-hint">
          PDF · até 8 MB · cópia guardada neste computador
        </span>
        <span className="reference-attachment-status" role="status">
          {attached ? "PDF anexado à fonte." : ""}
        </span>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
      </section>
      {onReturn && (
        <button className="text-button" onClick={onReturn}>
          Voltar ao texto
        </button>
      )}
    </>
  );
}
function ReferenceForm({
  initial,
  mutate,
  onDone,
  compact = false,
  projectRevision,
}: {
  initial?: Reference;
  mutate: Mutate;
  onDone: () => void;
  compact?: boolean;
  projectRevision: number;
}) {
  const base = useRef(projectRevision);
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  return (
    <form
      className={"inline-editor reference-form " + (compact ? "compact" : "")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        const f = Object.fromEntries(new FormData(e.currentTarget));
        setSaving(true);
        setError("");
        try {
          await mutate(initial ? "update_reference" : "add_reference", {
            ...f,
            ...(initial
              ? { referenceId: initial.id, expectedRevision: base.current }
              : {}),
          });
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      {!compact && (
        <div className="inline-editor-heading">
          <div>
            <strong>{initial ? "Editar fonte" : "Nova fonte"}</strong>
            <p>
              {initial
                ? "Atualize os dados desta referência."
                : "Preencha o que você já tem. Os outros detalhes podem vir depois."}
            </p>
          </div>
          <button type="button" className="text-button" onClick={onDone}>
            Cancelar
          </button>
        </div>
      )}
      <Field label="Título da fonte">
        <input
          name="title"
          autoFocus={compact || !initial}
          required
          defaultValue={initial?.title}
          placeholder="Título do artigo, livro ou documento"
        />
      </Field>
      <div className="form-grid">
        <Field label="Autores">
          <input
            name="authors"
            defaultValue={initial?.authors}
            placeholder="Como aparecem na publicação"
          />
        </Field>
        <Field label="Ano">
          <input
            name="year"
            defaultValue={initial?.year}
            placeholder="Ano de publicação"
          />
        </Field>
      </div>
      <Field label="URL ou página da publicação">
        <input
          type="url"
          name="url"
          defaultValue={initial?.url}
          placeholder="https://…"
        />
      </Field>
      <details>
        <summary>Mais detalhes</summary>
        <div className="form-grid">
          <Field label="Publicação">
            <input name="publication" defaultValue={initial?.publication} />
          </Field>
          <Field label="DOI">
            <input name="doi" defaultValue={initial?.doi} />
          </Field>
        </div>
        <Field label="Notas sobre esta fonte">
          <textarea name="note" rows={3} defaultValue={initial?.note} />
        </Field>
      </details>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={saving}>
          {saving
            ? "Guardando…"
            : initial
              ? "Guardar detalhes"
              : "Adicionar referência"}
        </button>
        {compact && (
          <button
            type="button"
            className="text-button"
            disabled={saving}
            onClick={onDone}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
export function References({
  state,
  mutate,
  onNavigate,
  refresh,
  onConnect,
  initialReferenceId,
}: {
  state: State;
  mutate: Mutate;
  onNavigate: (id: string) => void;
  refresh: () => Promise<void>;
  onConnect: () => void;
  initialReferenceId?: string;
}) {
  const [manual, setManual] = useState(false),
    [editingId, setEditingId] = useState(""),
    [selectedId, setSelectedId] = useState(initialReferenceId || ""),
    [query, setQuery] = useState(""),
    [help, setHelp] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  const selected = state.references.find((r) => r.id === selectedId);
  const list = state.references.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="collection references-page">
      <div className="page-heading">
        <div>
          <h1>Referências</h1>
          <p>As fontes que acompanham a sua escrita com o ChatGPT.</p>
        </div>
        <div className="page-heading-actions">
          <button
            className="text-button"
            onClick={() => {
              setManual(true);
              setSelectedId("");
            }}
          >
            <Plus size={14} />
            Adicionar fonte
          </button>
          <label className="text-button button-reset">
            <Upload size={14} />
            Importar BibTeX
            <input
              hidden
              type="file"
              accept=".bib"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void (async () => {
                    try {
                      await mutate("import_bibtex", {
                        source: await file.text(),
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })();
              }}
            />
          </label>
        </div>
      </div>
      {state.references.length > 0 && (
        <div className="reference-search">
          <SearchIcon />
          <input
            aria-label="Pesquisar referências"
            placeholder="Pesquisar por autor, título ou ano…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div
        className={"references-workspace " + (selected ? "has-selection" : "")}
      >
        <div className="reference-list">
          {manual && (
            <ReferenceForm
              projectRevision={state.revision}
              mutate={mutate}
              onDone={() => setManual(false)}
            />
          )}{" "}
          {!state.references.length && !manual && (
            <div className="ai-empty-state">
              <div className="ai-empty-icon">
                <LibraryIcon />
              </div>
              <h2>As fontes chegam com a conversa.</h2>
              <p>
                Peça ao ChatGPT para encontrar, registrar e citar as referências
                do trabalho. Elas aparecem aqui para você consultar, acompanhar
                e revisar.
              </p>
              <div className="actions">
                {!state.settings.mcpEnabled && (
                  <button className="primary" onClick={onConnect}>
                    Configurar ChatGPT
                  </button>
                )}
                <button onClick={() => setHelp(!help)}>
                  O que posso pedir?
                </button>
              </div>
              <p className="quiet-note">
                Também é possível importar sua bibliografia ou adicionar uma
                fonte manualmente.
              </p>
            </div>
          )}
          {help && (
            <div className="chatgpt-request">
              <div className="inline-editor-heading">
                <strong>Continue na sua conversa com o ChatGPT</strong>
                <button className="text-button" onClick={() => setHelp(false)}>
                  Fechar
                </button>
              </div>
              <p>
                Encontre fontes reais para este capítulo e registre-as no meu
                workspace, com os dados bibliográficos e o endereço da
                publicação. Relacione as citações ao texto e proponha as
                alterações necessárias para minha revisão.
              </p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    "Encontre fontes reais para este capítulo e registre-as no meu Laura Workspace, com os dados bibliográficos e o endereço da publicação. Relacione as citações ao texto e proponha as alterações necessárias para minha revisão.",
                  );
                  setCopied(true);
                }}
              >
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Copiado" : "Copiar pedido"}
              </button>
            </div>
          )}
          {list.map((r) => (
            <article
              key={r.id}
              className={
                "reference-card " + (editingId === r.id ? "is-editing" : "")
              }
            >
              {editingId === r.id ? (
                <ReferenceForm
                  initial={r}
                  projectRevision={state.revision}
                  mutate={mutate}
                  onDone={() => setEditingId("")}
                />
              ) : (
                <>
                  <div className="reference-card-top">
                    <BookOpen size={16} />
                    <span>
                      {r.origin === "mcp"
                        ? "Adicionada pelo ChatGPT"
                        : referenceUsages(state, r.key).length
                          ? "Citada no trabalho"
                          : "Ainda não citada"}
                    </span>
                    <button
                      className="text-button"
                      aria-label={"Editar fonte: " + r.title}
                      onClick={() => {
                        setEditingId(r.id);
                        setSelectedId("");
                      }}
                    >
                      <Pencil size={13} />
                      Editar
                    </button>
                  </div>
                  <h3>{r.title}</h3>
                  <p>
                    {r.authors || "Autores a complementar"}
                    {r.year && ` · ${r.year}`}
                  </p>
                  {r.publication && <p className="subtle">{r.publication}</p>}
                  <div className="reference-card-actions">
                    <button
                      className="text-button"
                      onClick={() =>
                        setSelectedId(selectedId === r.id ? "" : r.id)
                      }
                    >
                      Detalhes e citações <ArrowUpRight size={12} />
                    </button>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        Abrir fonte <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
        {selected && (
          <aside className="reference-inspector">
            <header>
              <button className="text-button" onClick={() => setSelectedId("")}>
                <ChevronLeft size={14} />
                Referências
              </button>
              <span className="subtle">Detalhes da fonte</span>
            </header>
            <ReferenceDetails
              key={selected.id}
              reference={selected}
              state={state}
              mutate={mutate}
              refresh={refresh}
              onNavigate={onNavigate}
            />
          </aside>
        )}
      </div>
    </section>
  );
}
function SearchIcon() {
  return <Search size={16} strokeWidth={1.6} />;
}
function LibraryIcon() {
  return <BookOpen size={24} strokeWidth={1.3} />;
}

export function Overview({
  state,
  onNavigate,
  onPage,
  onCreateNote,
}: {
  state: State;
  onNavigate: (id: string) => void;
  onPage: (p: string) => void;
  onCreateNote: () => void;
}) {
  const recentNotes = state.notes
    .filter((note) => note.state !== "Arquivada")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const count = (s: string) =>
    state.chapters.filter((c) => c.status === s).length;
  return (
    <section className="collection overview">
      <div className="page-heading">
        <div>
          <h1>O seu trabalho, com clareza.</h1>
          <p>{state.name} · tudo guardado neste computador.</p>
        </div>
        <BookOpen size={25} />
      </div>
      <div className="overview-metrics">
        <button onClick={() => onPage("comments")}>
          <strong>
            {state.comments.filter((c) => c.status === "open").length}
          </strong>
          <span>comentários em aberto</span>
        </button>
        <button onClick={() => onPage("proposals")}>
          <strong>
            {
              state.proposals.filter(
                (p) => p.status === "pending" || p.status === "approved",
              ).length
            }
          </strong>
          <span>alterações para revisar</span>
        </button>
        <button onClick={() => onPage("notes")}>
          <strong>
            {
              state.notes.filter(
                (n) => n.category === "Tarefa" && n.state === "Aberta",
              ).length
            }
          </strong>
          <span>tarefas no caderno</span>
        </button>
      </div>
      <h2>Estrutura do trabalho</h2>
      <p className="subtle">
        {count("Concluído")} de {state.chapters.length} capítulos marcados como
        concluídos por você.
      </p>
      {state.chapters.map((c, i) => (
        <button
          className="chapter-row"
          key={c.id}
          onClick={() => onNavigate(c.id)}
        >
          <span className="chapter-number">
            {String(c.number ?? i + 1).padStart(2, "0")}
          </span>
          <div>
            <h3>{c.title}</h3>
            <small>
              {plain(c.content).split(/\s+/).filter(Boolean).length} palavras ·{" "}
              {
                state.comments.filter(
                  (x) => x.chapterId === c.id && x.status === "open",
                ).length
              }{" "}
              comentários
            </small>
          </div>
          <span className="status">{c.status}</span>
          <ArrowUpRight size={17} />
        </button>
      ))}
      {!state.chapters.length && (
        <Empty
          title="O primeiro passo é a estrutura"
          description="Use o botão + ao lado de Capítulos ou importe um arquivo nas configurações."
        />
      )}
      <section className="recent-ideas" aria-labelledby="recent-ideas-title">
        <div className="recent-ideas-heading">
          <h2 id="recent-ideas-title">Ideias recentes</h2>
          <button className="text-button" onClick={onCreateNote}>
            <Plus size={14} />
            Nova ideia
          </button>
        </div>
        {recentNotes.length ? (
          <>
            <div className="recent-ideas-list">
              {recentNotes.map((note) => (
                <button
                  className="list-link"
                  key={note.id}
                  onClick={() => onPage("notes")}
                >
                  <Lightbulb size={16} />
                  <span>
                    <strong>{note.title || note.content.slice(0, 90)}</strong>
                    <small>{note.category}</small>
                  </span>
                  <ArrowUpRight className="list-link-trailing" size={14} />
                </button>
              ))}
            </div>
            <div className="recent-ideas-footer">
              <p>
                Também vale pedir ao ChatGPT: “Guarde esta ideia no meu
                caderno.”
              </p>
              <button className="text-button" onClick={() => onPage("notes")}>
                Abrir caderno <ArrowUpRight size={12} />
              </button>
            </div>
          </>
        ) : (
          <div className="ideas-empty">
            <p>Seu caderno começa com uma ideia.</p>
            <span>
              Anote um pensamento, uma dúvida ou peça ao ChatGPT para guardar
              algo da conversa aqui.
            </span>
          </div>
        )}
      </section>
    </section>
  );
}
