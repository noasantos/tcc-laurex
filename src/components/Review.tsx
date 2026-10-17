import { CopyCommentReference } from "./CopyCommentReference";
import { commentReference } from "../../server/comment-reference";
import { CommentText } from "./CommentText";
import "./comments.css";
import { Select, SelectOption } from "./Select";
import { useState, useEffect } from "react";
import {
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
  RotateCcw,
  X,
} from "lucide-react";
import type { State, Comment, Proposal } from "../../server/types";
import { ChangeComparison } from "./ChangeComparison";
import { resolveAnchor } from "../../server/anchors";
import { Empty, date } from "./Primitives";
export type Mutate = (
  name: string,
  args: Record<string, unknown>,
) => Promise<any>;
export function ProposalDetail({
  p,
  mutate,
  onCompare,
  compact = false,
}: {
  p: Proposal;
  mutate: Mutate;
  onCompare?: (p: Proposal) => void;
  compact?: boolean;
}) {
  return (
    <div className="proposal">
      <div className="row-between">
        <strong>{p.reason}</strong>
        <span className={"status " + p.status}>
          {
            {
              pending: "Aguardando revisão",
              approved: "Aprovada",
              applied: "Aplicada",
              rejected: "Rejeitada",
              reverted: "Revertida",
            }[p.status]
          }
        </span>
      </div>
      <small>
        Proposta em {date(p.createdAt)}
        {` · documento na revisão ${p.baseChapterRevision}`}
        {p.appliedVersion ? ` · versão ${p.appliedVersion}` : ""}
        {p.operationId ? ` · operação ${p.operationId.slice(0, 8)}` : ""}
      </small>
      {p.approvedAt && <small>Aprovada em {date(p.approvedAt)}</small>}
      {p.appliedAt && <small>Aplicada em {date(p.appliedAt)}</small>}
      {p.rejectedAt && <small>Rejeitada em {date(p.rejectedAt)}</small>}
      <ChangeComparison proposal={p} compact={compact} />
      <div className="actions">
        {onCompare && (
          <button className="text-button" onClick={() => onCompare(p)}>
            Ver no documento <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <div className="actions">
        {p.status === "pending" && (
          <button
            className="primary"
            onClick={() => mutate("approve_edit", { proposalId: p.id })}
          >
            Aprovar alteração
          </button>
        )}
        {p.status === "approved" && (
          <button
            className="primary"
            onClick={() => mutate("apply_approved_edit", { proposalId: p.id })}
          >
            Aplicar alteração aprovada
          </button>
        )}
        {["pending", "approved"].includes(p.status) && (
          <button
            onClick={() => mutate("reject_edit_proposal", { proposalId: p.id })}
          >
            Rejeitar
          </button>
        )}
      </div>
    </div>
  );
}
export function DocumentComparison({
  p,
  title,
  mutate,
  onClose,
}: {
  p: Proposal;
  title: string;
  mutate: Mutate;
  onClose: () => void;
}) {
  return (
    <div className="document-comparison">
      <div className="document-comparison-header">
        <span>Comparação · {title}</span>
        <button className="text-button" onClick={onClose}>
          Voltar ao documento <X size={14} />
        </button>
      </div>
      <div className="document-comparison-body">
        <h2>Antes e depois</h2>
        <p className="comparison-note">
          Versões preservadas desta alteração. A comparação é somente leitura e
          pode diferir do documento atual. Aplicar uma alteração mantém o
          comentário em aberto.
        </p>
        <ProposalDetail key={p.id} p={p} mutate={mutate} />
      </div>
    </div>
  );
}
export function anchorStatus(c: Comment, s: State) {
  const chapter = s.chapters.find((x) => x.id === c.chapterId);
  if (!chapter) return "Capítulo não localizado";
  const r = resolveAnchor(chapter.content, c);
  return (
    {
      chapter: "Comentário do capítulo",
      orphan: "Trecho alterado ou ambíguo · necessita reconciliação",
      recovered: "Trecho recuperado com segurança pelo contexto",
      linked: "Vinculado ao trecho original",
    }[r.status] || "Necessita reconciliação"
  );
}
export function CommentsPanel({
  state,
  mutate,
  chapterId,
  selectedId,
  visibleAnchorIds = [],
  onNavigate,
  onCompare,
}: {
  state: State;
  mutate: Mutate;
  chapterId?: string;
  selectedId?: string;
  visibleAnchorIds?: string[];
  onCompare?: (p: Proposal) => void;
  onNavigate: (id: string, commentId?: string) => void;
}) {
  const [author, setAuthor] = useState(""),
    [since, setSince] = useState("");
  const [filter, setFilter] = useState(selectedId ? "all" : "open"),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(""),
    [chapterFilter, setChapterFilter] = useState(chapterId || "");
  useEffect(() => {
    if (selectedId) {
      const item = document.getElementById("comment-" + selectedId);
      const pane = item?.closest<HTMLElement>(".review-panel");
      if (item && pane) {
        const row = item.getBoundingClientRect(),
          area = pane.getBoundingClientRect();
        if (row.top < area.top || row.top > area.bottom - 80)
          pane.scrollTop += row.top - area.top - 16;
      }
    }
  }, [selectedId]);
  const comments = state.comments.filter(
    (c) =>
      (!chapterFilter || c.chapterId === chapterFilter) &&
      (filter === "all" || c.status === filter) &&
      (!author || (c.author || "Laura") === author) &&
      (!since || c.createdAt.slice(0, 10) >= since) &&
      (JSON.stringify(c) + commentReference(c.id))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="review-panel">
      <div className="page-heading">
        <div>
          <h1>Comentários</h1>
          <p>Orientações, decisões e alterações, no mesmo lugar.</p>
        </div>
        <MessageSquare size={23} />
      </div>
      <div className="filters">
        <Select
          aria-label="Estado dos comentários"
          value={filter}
          onValueChange={(value) => setFilter(value)}
        >
          <SelectOption value="open">Em aberto</SelectOption>
          <SelectOption value="resolved">Concluídos</SelectOption>
          <SelectOption value="all">Todos</SelectOption>
        </Select>
        {!chapterId && (
          <>
            <Select
              aria-label="Capítulo dos comentários"
              value={chapterFilter}
              onValueChange={(value) => setChapterFilter(value)}
            >
              <SelectOption value="">Todos os capítulos</SelectOption>
              {state.chapters.map((c) => (
                <SelectOption value={c.id} key={c.id}>
                  {c.title}
                </SelectOption>
              ))}
            </Select>
            <Select
              aria-label="Autor do comentário"
              value={author}
              onValueChange={(value) => setAuthor(value)}
            >
              <SelectOption value="">Todos os autores</SelectOption>
              <SelectOption>Laura</SelectOption>
              <SelectOption>ChatGPT</SelectOption>
            </Select>
            <input
              aria-label="Comentários a partir de"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </>
        )}
        <input
          placeholder="Pesquisar comentários…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!comments.length && (
        <Empty
          title="Tudo em ordem por aqui"
          description="Comentários sobre o texto e as respostas do ChatGPT aparecem aqui."
        />
      )}
      {comments.map((c) => {
        const proposals = state.proposals.filter((p) => p.commentId === c.id);
        const open = expanded === c.id;
        const chapter = state.chapters.find((x) => x.id === c.chapterId);
        const anchor = chapter
          ? resolveAnchor(chapter.content, c)
          : { status: "orphan", ranges: [] };
        const linked = anchor.ranges.length > 0;
        const alreadyVisible = linked && visibleAnchorIds.includes(c.id);
        return (
          <article
            key={c.id}
            id={"comment-" + c.id}
            className={"comment-item " + (open ? "expanded" : "")}
          >
            <div className="comment-heading">
              <button
                className="comment-summary"
                onClick={() => setExpanded(open ? "" : c.id)}
                aria-expanded={open}
                aria-label={
                  (open
                    ? "Recolher detalhes do comentário"
                    : "Abrir detalhes do comentário") +
                  " de " +
                  (c.author || "Laura")
                }
              >
                <span className="comment-avatar">
                  {(c.author || "Laura").slice(0, 1)}
                </span>
                <div>
                  <small>
                    {state.chapters.find((x) => x.id === c.chapterId)?.title} ·{" "}
                    {date(c.createdAt)}
                  </small>

                  <span className="subtle">
                    {c.status === "resolved" ? "Concluído" : "Em aberto"}
                  </span>
                </div>
              </button>
              <button
                className="comment-complete text-button"
                onClick={() =>
                  mutate(
                    c.status === "resolved"
                      ? "reopen_comment"
                      : "resolve_comment",
                    { commentId: c.id },
                  )
                }
              >
                {c.status === "resolved" ? (
                  <RotateCcw size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {c.status === "resolved" ? "Reabrir" : "Concluir"}
              </button>
            </div>
            <div className="comment-context">
              {c.quote ? (
                <CommentText text={c.quote} quote limit={220} />
              ) : (
                <p className="comment-chapter-scope">
                  Sobre o capítulo inteiro
                </p>
              )}
              <CommentText text={c.body} />
              <div className="comment-context-actions">
                <CopyCommentReference comment={c} />
                <button
                  className="text-button"
                  disabled={alreadyVisible}
                  title={
                    alreadyVisible
                      ? "Trecho já visível no documento"
                      : undefined
                  }
                  onClick={() => onNavigate(c.chapterId, c.id)}
                >
                  {linked ? "Ir ao trecho" : "Abrir capítulo"}{" "}
                  <ArrowUpRight size={14} />
                </button>
                {!open && (
                  <button
                    className="text-button"
                    onClick={() => setExpanded(c.id)}
                  >
                    {c.replies.length
                      ? `Ver respostas (${c.replies.length})`
                      : "Responder"}
                  </button>
                )}
              </div>
              {anchor.status === "orphan" && (
                <p className="anchor-state">
                  {proposals.some((p) => p.status === "applied")
                    ? "O texto foi revisado. O trecho original está preservado acima; veja a alteração em Antes e depois."
                    : "O trecho mudou ou não foi localizado com segurança. A seleção original foi mantida acima."}
                </p>
              )}
            </div>
            {proposals.length > 0 && (
              <div className="comment-changes">
                {proposals.map((p) => (
                  <details key={p.id} className="comment-change">
                    <summary>
                      Antes e depois{" "}
                      <span>
                        {
                          {
                            pending: "Proposta",
                            approved: "Aprovada",
                            applied: "Aplicada",
                            rejected: "Rejeitada",
                            reverted: "Revertida",
                          }[p.status]
                        }
                      </span>
                    </summary>
                    <ProposalDetail
                      p={p}
                      mutate={mutate}
                      onCompare={onCompare}
                      compact
                    />
                  </details>
                ))}
              </div>
            )}
            {open && (
              <div className="comment-detail">
                {anchor.status !== "orphan" && (
                  <p className="anchor-state">{anchorStatus(c, state)}</p>
                )}
                {c.replies.map((r, i) => (
                  <div className="reply" key={i}>
                    <small>
                      {r.origin === "mcp" ? "ChatGPT" : "Laura"} · {date(r.at)}
                    </small>
                    <CommentText text={r.body} limit={600} />
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    await mutate("reply_to_comment", {
                      commentId: c.id,
                      body: new FormData(form).get("reply"),
                    });
                    form.reset();
                  }}
                >
                  <textarea
                    aria-label="Resposta ao comentário"
                    name="reply"
                    placeholder="Adicionar uma resposta…"
                    required
                  />
                  <div className="actions">
                    <button type="submit">Responder</button>
                  </div>
                </form>
                {c.status === "resolved" &&
                  !proposals.some((p) => p.status === "applied") && (
                    <p className="notice">
                      Concluído sem alteração textual associada.
                    </p>
                  )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
