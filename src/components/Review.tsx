import { CopyCommentReference } from "./CopyCommentReference";
import { CommentFilters } from "./CommentFilters";
import { selectComments } from "./comment-filters";
import { Tabs, TabsContent } from "./ui/tabs";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./ui/tooltip";
import "./comment-workspace.css";
import { CommentText } from "./CommentText";
import "./comments.css";
import { useState, useEffect } from "react";
import { ArrowUpRight, CheckCircle2, RotateCcw, X } from "lucide-react";
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
    [period, setPeriod] = useState(""),
    [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState(
      chapterId && !selectedId ? "open" : "all",
    ),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(""),
    [chapterFilter, setChapterFilter] = useState(chapterId || "");
  useEffect(() => {
    if (selectedId) {
      const item = document.getElementById("comment-" + selectedId);
      const pane = item?.closest<HTMLElement>(".comments-list");
      if (item && pane) {
        const row = item.getBoundingClientRect(),
          area = pane.getBoundingClientRect();
        if (row.top < area.top || row.top > area.bottom - 80)
          pane.scrollTop += row.top - area.top - 16;
      }
    }
  }, [selectedId]);
  const result = selectComments(state.comments, {
    chapterId: chapterFilter,
    author,
    period,
    sort,
    query: search,
  });
  const comments = result.comments.filter(
    (c) => filter === "all" || c.status === filter,
  );
  return (
    <Tabs
      value={filter}
      onValueChange={setFilter}
      className={
        "review-panel comments-workspace " + (chapterId ? "is-contextual" : "")
      }
    >
      <div className="comments-page-heading">
        <div className="comments-title-line">
          <h1>Comentários</h1>
          <Badge variant="ghost">
            {
              state.comments.filter(
                (c) => !chapterId || c.chapterId === chapterId,
              ).length
            }
          </Badge>
        </div>
        {!chapterId && (
          <p>Orientações, decisões e alterações, no mesmo lugar.</p>
        )}
      </div>
      <CommentFilters
        counts={result}
        chapters={state.chapters}
        chapterId={chapterFilter}
        author={author}
        period={period}
        sort={sort}
        search={search}
        compact={Boolean(chapterId)}
        setChapter={setChapterFilter}
        setAuthor={setAuthor}
        setPeriod={setPeriod}
        setSort={setSort}
        setSearch={setSearch}
      />
      <TabsContent value={filter} className="comments-list">
        {!comments.length && (
          <Empty
            title={
              state.comments.length
                ? "Nenhum comentário nesta seleção"
                : "Um espaço para revisar seu trabalho"
            }
            description={
              state.comments.length
                ? "Experimente outro estado ou ajuste os filtros."
                : "Selecione um trecho no documento para comentar. Você também pode pedir ao ChatGPT para registrar uma orientação sua ou avaliar o texto e deixar comentários."
            }
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
                    <small className="comment-author">
                      {c.author || "Laura"}
                      {c.origin === "mcp" && c.author === "Laura" && (
                        <span> · via ChatGPT</span>
                      )}
                    </small>
                    <small className="comment-metadata">
                      <span>
                        {
                          state.chapters.find((x) => x.id === c.chapterId)
                            ?.title
                        }
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={c.createdAt}>{date(c.createdAt)}</time>
                    </small>
                  </div>
                </button>
                <div className="comment-status-row">
                  <span
                    className="subtle comment-state-label"
                    data-status={c.status}
                  >
                    <span
                      className="comment-state-dot"
                      data-status={c.status}
                    />
                    {c.status === "resolved" ? "Concluído" : "Em aberto"}
                  </span>
                  <TooltipProvider delayDuration={250}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="comment-complete comment-complete-icon text-button"
                          aria-label={
                            c.status === "resolved"
                              ? "Reabrir comentário"
                              : "Concluir comentário"
                          }
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
                            <RotateCcw size={16} aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={16} aria-hidden="true" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className="motion-reduce:animate-none"
                      >
                        {c.status === "resolved"
                          ? "Reabrir comentário"
                          : "Concluir comentário"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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
                        {r.author || (r.origin === "mcp" ? "ChatGPT" : "Laura")}
                        {r.origin === "mcp" && r.author === "Laura"
                          ? " · via ChatGPT"
                          : ""}{" "}
                        · {date(r.at)}
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
      </TabsContent>
    </Tabs>
  );
}
