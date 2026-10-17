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
} from "lucide-react";
import type { State, Comment, Proposal } from "../../server/types";
import { plain } from "../../server/types";
import { resolveAnchor } from "../../server/anchors";
import { Diff, Empty, date } from "./Primitives";
export type Mutate = (
  name: string,
  args: Record<string, unknown>,
) => Promise<any>;
export function ProposalDetail({ p, mutate }: { p: Proposal; mutate: Mutate }) {
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
        {p.appliedVersion ? ` · versão ${p.appliedVersion}` : ""}
        {p.operationId ? ` · operação ${p.operationId.slice(0, 8)}` : ""}
      </small>
      {p.approvedAt && <small>Aprovada em {date(p.approvedAt)}</small>}
      {p.appliedAt && <small>Aplicada em {date(p.appliedAt)}</small>}
      {p.rejectedAt && <small>Rejeitada em {date(p.rejectedAt)}</small>}
      <Diff before={p.before} after={p.after} />
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
  onNavigate,
}: {
  state: State;
  mutate: Mutate;
  chapterId?: string;
  selectedId?: string;
  onNavigate: (id: string, commentId?: string) => void;
}) {
  const [author, setAuthor] = useState(""),
    [since, setSince] = useState("");
  const [filter, setFilter] = useState(selectedId ? "all" : "open"),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(selectedId || ""),
    [chapterFilter, setChapterFilter] = useState(chapterId || "");
  useEffect(() => {
    if (selectedId) {
      setExpanded(selectedId);
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
      (filter === "all" ||
        (filter === "open" && c.status === "open") ||
        (c.reviewState || c.status) === filter) &&
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
          <SelectOption value="resolved">Resolvidos</SelectOption>
          <SelectOption value="analyzing">Em análise</SelectOption>
          <SelectOption value="proposed">Alteração proposta</SelectOption>
          <SelectOption value="reopened">Reabertos</SelectOption>
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
        return (
          <article
            key={c.id}
            id={"comment-" + c.id}
            className={"comment-item " + (open ? "expanded" : "")}
          >
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
                  {c.reviewState === "reopened"
                    ? "Reaberto"
                    : c.reviewState === "analyzing"
                      ? "Em análise"
                      : c.status === "resolved"
                        ? "Resolvido"
                        : proposals.some((p) => p.status === "pending")
                          ? "Alteração proposta"
                          : c.replies.length
                            ? "Em análise"
                            : "Aberto"}
                  {proposals.length
                    ? ` · ${proposals.length} alteração(ões) associada(s)`
                    : ""}
                </span>
              </div>
            </button>
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
                  O trecho mudou ou não foi localizado com segurança. A seleção
                  original foi mantida acima.
                </p>
              )}
            </div>
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
                    {c.status !== "resolved" && (
                      <button
                        type="button"
                        onClick={() =>
                          mutate("set_comment_state", {
                            commentId: c.id,
                            state: "analyzing",
                          })
                        }
                      >
                        Em análise
                      </button>
                    )}
                    <button
                      type="button"
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
                      )}{" "}
                      {c.status === "resolved"
                        ? "Reabrir"
                        : "Resolver explicitamente"}
                    </button>
                  </div>
                </form>
                {c.status === "resolved" &&
                  !proposals.some((p) => p.status === "applied") && (
                    <p className="notice">
                      Resolvido sem alteração textual associada.
                    </p>
                  )}
                {proposals.map((p) => (
                  <ProposalDetail key={p.id} p={p} mutate={mutate} />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
