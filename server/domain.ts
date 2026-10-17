import {Cite} from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { diffWords } from "diff";
import { Store } from "./store";
import { emptyDoc, plain, type State, type Doc } from "./types";
import { resolveAnchor, anchorText } from "./anchors";
import { commentReference, findCommentReference } from "./comment-reference";
import { validateDoc } from "./documents";
import { setChapterLatex, projectLatex, visualLatex } from "./chapter-source";
const id = z.string().min(1).max(200),
  text = z.string().max(200000),
  rev = z.number().int().positive();
const documentNode: z.ZodType<Doc> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      text: z.string().optional(),
      attrs: z.record(z.string(), z.json()).optional(),
      marks: z
        .array(
          z.object({
            type: z.string(),
            attrs: z.record(z.string(), z.json()).optional(),
          }),
        )
        .optional(),
      content: z.array(documentNode).optional(),
    })
    .strict(),
);
const doc = documentNode.superRefine((v, c) => {
  try {
    validateDoc(v);
  } catch (e) {
    c.addIssue({ code: "custom", message: (e as Error).message });
  }
});
const status = z.enum([
  "Planejado",
  "Em desenvolvimento",
  "Em revisão",
  "Concluído",
]);
const category = z.enum([
  "Pensamento",
  "Dúvida",
  "Hipótese",
  "Tarefa",
  "Referência a investigar",
  "Decisão acadêmica",
  "Sugestão da IA",
]);
export const schemas = {
  get_project_info: z.object({}),
  get_project_structure: z.object({}),
  get_project_status: z.object({}),
  list_chapters: z.object({}),
  read_chapter: z.object({ chapterId: id }),
  create_chapter: z.object({
    expectedRevision: rev,
    title: id,
    parentId: id.nullable().optional(),
    content: doc.optional(),
    latex: z.string().max(5_000_000).optional(),
    position: z.number().int().nonnegative().optional(),
    plan: text.optional(),
  }),
  update_chapter: z.object({
    expectedRevision: rev,
    chapterId: id,
    chapterRevision: rev,
    title: id.optional(),
    status: status.optional(),
    content: doc.optional(),
    latex: z.string().max(5_000_000).optional(),
  }),
  reorder_chapters: z.object({ expectedRevision: rev, ids: z.array(id) }),
  update_chapter_plan: z.object({
    expectedRevision: rev,
    chapterId: id,
    plan: text,
  }),
  set_comment_state: z.object({
    expectedRevision: rev,
    commentId: id,
    state: z.enum(["open", "analyzing"]),
  }),
  list_comments: z.object({
    chapterId: id.optional(),
    status: z.enum(["open", "resolved"]).optional(),
    query: text.optional(),
  }),
  get_comment: z.object({ commentId: id }),
  create_comment: z.object({
    expectedRevision: rev,
    chapterId: id,
    body: text.min(1),
    quote: text.optional(),
    anchor: z
      .object({
        blockIds: z.array(id).optional(),
        blockId: id.optional(),
        prefix: text.optional(),
        suffix: text.optional(),
        scope: z
          .enum(["selection", "paragraph", "section", "chapter"])
          .optional(),
      })
      .optional(),
  }),
  reply_to_comment: z.object({
    expectedRevision: rev,
    commentId: id,
    body: text.min(1),
  }),
  resolve_comment: z.object({ expectedRevision: rev, commentId: id }),
  reopen_comment: z.object({ expectedRevision: rev, commentId: id }),
  list_notes: z.object({ chapterId: id.optional(), query: text.optional() }),
  create_note: z.object({
    expectedRevision: rev,
    title: text.optional(),
    content: text.min(1),
    category: category.optional(),
    chapterId: id.nullable().optional(),
    state: text.optional(),
  }),
  update_note: z.object({
    expectedRevision: rev,
    noteId: id,
    title: text.optional(),
    content: text.optional(),
    category: category.optional(),
    state: text.optional(),
  }),
  link_note_to_chapter: z.object({
    expectedRevision: rev,
    noteId: id,
    chapterId: id.nullable(),
  }),
  propose_edit: z.object({
    expectedRevision: rev,
    chapterId: id,
    chapterRevision: rev,
    after: doc.optional(),
    afterLatex: z.string().max(5_000_000).optional(),
    reason: text.min(1),
    commentId: id.optional(),
  }),
  get_edit_proposal: z.object({ proposalId: id }),
  list_edit_proposals: z.object({ chapterId: id.optional() }),
  approve_edit: z.object({ expectedRevision: rev, proposalId: id }),
  apply_approved_edit: z.object({ expectedRevision: rev, proposalId: id }),
  reject_edit_proposal: z.object({ expectedRevision: rev, proposalId: id }),
  list_versions: z.object({}),
  get_version: z.object({ version: rev }),
  compare_versions: z.object({ before: rev, after: rev, chapterId: id }),
  restore_version: z.object({ expectedRevision: rev, version: rev }),
  list_references: z.object({}),
  get_reference: z.object({ referenceId: id }),
  update_reference: z.object({expectedRevision:rev,referenceId:id,title:text.optional(),authors:text.optional(),year:text.optional(),publication:text.optional(),doi:text.optional(),url:z.union([z.literal(''),z.url().refine(v=>/^https?:\/\//.test(v))]).optional(),note:text.optional(),evidenceUrl:z.union([z.literal(""),z.url().refine(v=>/^https?:\/\//.test(v))]).optional(),evidenceNote:text.optional(),verified:z.boolean().optional()}),
  import_bibtex:z.object({expectedRevision:rev,source:z.string().min(1).max(2_000_000),onDuplicate:z.enum(["skip","error"]).optional()}),
  add_reference: z.object({
    expectedRevision: rev,
    key: id.optional(),
    title: text.min(1),
    authors: text.optional(),
    year: text.optional(),
    publication: text.optional(),
    doi: text.optional(),
    url: z
      .union([z.literal(""), z.url().refine((v) => /^https?:\/\//.test(v))])
      .optional(),
    type: text.optional(),
    note: text.optional(),
    evidenceUrl:z.union([z.literal(""),z.url().refine(v=>/^https?:\/\//.test(v))]).optional(),evidenceNote:text.optional(),
    bibtex: text.optional(),
  }),
  find_citations: z.object({ key: id }),
  update_settings: z.object({
    expectedRevision: rev,
    name: id.optional(),
    backupRetentionDays: z.number().int().min(0).max(3650).optional(),
    mcpEnabled: z.boolean().optional(),
    mcpWrite: z.boolean().optional(),
  }),
};
for (const key of Object.keys(schemas) as (keyof typeof schemas)[])
  (schemas as any)[key] = schemas[key].strict();
export type ToolName = keyof typeof schemas;
export const readonlyTools = new Set([
  "get_project_info",
  "get_project_structure",
  "get_project_status",
  "list_chapters",
  "read_chapter",
  "list_comments",
  "get_comment",
  "list_notes",
  "get_edit_proposal",
  "list_edit_proposals",
  "list_versions",
  "get_version",
  "compare_versions",
  "list_references",
  "get_reference",
  "find_citations",
]);
const need = <T extends { id: string }>(xs: T[], id: string) => {
  const x = xs.find((x) => x.id === id);
  if (!x)
    throw Object.assign(new Error("Identificador não encontrado"), {
      statusCode: 404,
    });
  return x;
};
function citations(d: Doc, key: string): boolean {
  return (
    (d.type === "citation" && String(d.attrs?.key).split(",").includes(key)) ||
    (d.content || []).some((c) => citations(c, key))
  );
}
export class Domain {
  constructor(public store: Store) {}
  call(name: ToolName, raw: unknown, origin = "ui"): any {
    if (!(name in schemas)) throw new Error("Operação inexistente");
    const a: any = schemas[name].parse(raw);
    const current = this.store.get();
    if (origin === "mcp") {
      if (!current.settings.mcpEnabled)
        throw new Error("Conexão MCP desligada nas configurações");
      if (["approve_edit", "update_settings", "restore_version"].includes(name))
        throw new Error("Esta decisão exige a interface local");
      if (!readonlyTools.has(name) && !current.settings.mcpWrite)
        throw new Error("Escrita MCP não autorizada");
    }
    if (typeof a.commentId === "string")
      a.commentId = findCommentReference(current.comments, a.commentId).id;
    const chapter = (s: State) => need(s.chapters, a.chapterId);
    const comment = (s: State) => need(s.comments, a.commentId);
    const proposal = (s: State) => need(s.proposals, a.proposalId);
    if (readonlyTools.has(name)) {
      switch (name) {
        case "get_project_info":
          return {
            id: current.id,
            name: current.name,
            revision: current.revision,
          };
        case "list_chapters":
        case "get_project_structure":
          return current.chapters.map(({ content, plan, latex, latexWarnings, ...c }) => c);
        case "read_chapter":
          return chapter(current);
        case "get_project_status":
          return {
            revision: current.revision,
            chapters: current.chapters.map(({ id, title, status }) => ({
              id,
              title,
              status,
            })),
            openComments: current.comments.filter((x) => x.status === "open")
              .length,
            pendingEdits: current.proposals.filter(
              (x) => x.status === "pending",
            ).length,
            tasks: current.notes.filter(
              (x) => x.category === "Tarefa" && x.state !== "Concluída",
            ).length,
          };
        case "list_comments":
          return current.comments.map(c => ({ ...c, reference: commentReference(c.id) })).filter(
            c => (!a.chapterId || c.chapterId === a.chapterId) &&
              (!a.status || c.status === a.status) &&
              (!a.query || JSON.stringify(c).toLowerCase().includes(a.query.toLowerCase())),
          );
        case "get_comment": {
          const c = comment(current), chapter = need(current.chapters, c.chapterId);
          const resolution = resolveAnchor(chapter.content, c);
          const blocks = new Map<string, Doc>();
          const indexBlocks = (doc: Doc) => {
            if (typeof doc.attrs?.id === "string") blocks.set(doc.attrs.id, doc);
            doc.content?.forEach(indexBlocks);
          };
          indexBlocks(chapter.content);
          return {
            ...c,
            reference: commentReference(c.id),
            project: { id: current.id, name: current.name, revision: current.revision },
            chapter: { id: chapter.id, title: chapter.title, revision: chapter.revision },
            currentExcerpt: resolution.ranges.length ? resolution.ranges.map(range => {
              const block = blocks.get(range.blockId);
              return block ? anchorText(block).slice(range.from, range.to) : "";
            }).join("\n\n") : null,
            anchorResolution: resolution,
            proposals: current.proposals.filter(p => p.commentId === c.id),
          };
        }
        case "list_notes":
          return current.notes.filter(
            (n) =>
              (!a.chapterId || n.chapterId === a.chapterId) &&
              (!a.query ||
                JSON.stringify(n)
                  .toLowerCase()
                  .includes(a.query.toLowerCase())),
          );
        case "get_edit_proposal":
          return proposal(current);
        case "list_edit_proposals":
          return current.proposals.filter(
            (p) => !a.chapterId || p.chapterId === a.chapterId,
          );
        case "list_versions":
          return this.store.versions();
        case "get_version":
          return this.store.version(a.version);
        case "compare_versions": {
          const b = need(this.store.version(a.before).chapters, a.chapterId),
            c = need(this.store.version(a.after).chapters, a.chapterId);
          return diffWords(b.latex ?? plain(b.content), c.latex ?? plain(c.content));
        }
        case "list_references":
          return current.references;
        case "get_reference":
          return need(current.references, a.referenceId);
        case "find_citations":
          return current.chapters
            .filter((c) => citations(c.content, a.key))
            .map((c) => ({ chapterId: c.id, title: c.title }));
      }
    }
    if (
      ["restore_version", "apply_approved_edit", "update_chapter"].includes(
        name,
      )
    )
      this.store.backup();
    let result: any;
    const next = this.store.commit(
      a.expectedRevision,
      name,
      origin,
      (s, operationId) => {
        const now = new Date().toISOString();
        switch (name) {
          case "create_chapter": {
            if (a.parentId) {
              const p = need(s.chapters, a.parentId);
              let depth = 1,
                parent = p;
              while (parent.parentId) {
                parent = need(s.chapters, parent.parentId);
                if (++depth > 2) throw new Error("Máximo de três níveis");
              }
            }
            result = {
              id: randomUUID(),
              title: a.title,
              status: "Planejado",
              parentId: a.parentId || null,
              plan: a.plan || "",
              content: a.content || emptyDoc(),
              revision: 1,
            };
            if (a.latex !== undefined && a.content !== undefined) throw new Error("Envie latex ou content, nunca ambos.");
            if (a.latex !== undefined) setChapterLatex(result, a.latex);
            if (a.position !== undefined && a.position > s.chapters.length) throw new Error("Posição de capítulo inválida");
            s.chapters.splice(a.position ?? s.chapters.length, 0, result);
            break;
          }
          case "update_chapter": {
            const c = chapter(s);
            if (c.revision !== a.chapterRevision)
              throw Object.assign(new Error("Capítulo mudou desde a leitura"), {
                statusCode: 409,
              });
            if (origin === "mcp" && (a.content !== undefined || a.latex !== undefined))
              throw new Error(
                "Para revisar conteúdo existente, use propose_document_edit; Laura aprova na interface",
              );
            for (const k of ["title", "status", "content"] as const)
              if (a[k] !== undefined) (c as any)[k] = a[k];
            if (a.latex !== undefined && a.content !== undefined) throw new Error("Envie latex ou content, nunca ambos.");
            if (a.latex !== undefined) setChapterLatex(c, a.latex);
            c.revision++;
            result = c;
            break;
          }
          case "update_chapter_plan":
            chapter(s).plan = a.plan;
            result = chapter(s);
            break;
          case "reorder_chapters": {
            if (
              new Set(a.ids).size !== s.chapters.length ||
              a.ids.length !== s.chapters.length ||
              a.ids.some((i: string) => !s.chapters.some((c) => c.id === i))
            )
              throw new Error("Envie cada capítulo exatamente uma vez");
            s.chapters = a.ids.map((i: string) => need(s.chapters, i));
            result = a.ids;
            break;
          }
          case "create_comment":
            chapter(s);
            result = {
              id: randomUUID(),
              chapterId: a.chapterId,
              body: a.body,
              quote: a.quote || "",
              anchor: a.anchor || { scope: "chapter" },
              status: "open",
              author: origin === "mcp" ? "ChatGPT" : "Laura",
              reviewState: "open",
              history: [
                { at: now, action: "created", origin, version: s.revision + 1 },
              ],
              replies: [],
              createdAt: now,
            };
            s.comments.push(result);
            break;
          case "set_comment_state":
            comment(s).reviewState = a.state;
            comment(s).status = "open";
            result = comment(s);
            break;
          case "reply_to_comment":
            comment(s).replies.push({ body: a.body, at: now, origin });
            result = comment(s);
            break;
          case "resolve_comment":
            comment(s).reviewState = "resolved";
            comment(s).history?.push({
              at: now,
              action: "resolved",
              origin,
              version: s.revision + 1,
            });
            comment(s).status = "resolved";
            comment(s).resolvedAt = now;
            result = comment(s);
            break;
          case "reopen_comment":
            comment(s).reviewState = "reopened";
            comment(s).history?.push({
              at: now,
              action: "reopened",
              origin,
              version: s.revision + 1,
            });
            comment(s).status = "open";
            delete comment(s).resolvedAt;
            result = comment(s);
            break;
          case "create_note":
            if (a.chapterId) chapter(s);
            result = {
              id: randomUUID(),
              title: a.title || "",
              content: a.content,
              category: a.category || "Pensamento",
              chapterId: a.chapterId || null,
              state: a.state || "Aberta",
              origin,
              createdAt: now,
              updatedAt: now,
            };
            s.notes.push(result);
            break;
          case "update_note": {
            const n = need(s.notes, a.noteId);
            for (const k of ["title", "content", "category", "state"] as const)
              if (a[k] !== undefined) n[k] = a[k];
            n.updatedAt = now;
            result = n;
            break;
          }
          case "link_note_to_chapter":
            if (a.chapterId) chapter(s);
            result = need(s.notes, a.noteId);
            result.chapterId = a.chapterId;
            result.updatedAt = now;
            break;
          case "propose_edit": {
            const c = chapter(s);
            if (c.revision !== a.chapterRevision)
              throw new Error("Capítulo mudou desde a leitura");
            if (a.commentId && comment(s).chapterId !== c.id)
              throw new Error("Comentário pertence a outro capítulo");
            if ((a.after === undefined) === (a.afterLatex === undefined)) throw new Error("Envie afterLatex (fonte nativo) ou after, nunca ambos.");
            if (c.latexWarnings?.length && a.after !== undefined) throw new Error("Use afterLatex para preservar o fonte protegido.");
            const after = a.afterLatex !== undefined ? projectLatex(a.afterLatex, c.content).doc : a.after;
            const afterLatex = a.afterLatex ?? visualLatex(after, c.id);
            result = {
              id: randomUUID(),
              chapterId: c.id,
              commentId: a.commentId,
              baseChapterRevision: c.revision,
              before: c.content,
              after,
              beforeLatex: c.latex,
              afterLatex,
              reason: a.reason,
              status: "pending",
              createdAt: now,
            };
            s.proposals.push(result);
            if (a.commentId) {
              const c = comment(s);
              if (c.status !== "resolved") c.reviewState = "proposed";
              c.history?.push({
                at: now,
                action: "proposed",
                origin,
                version: s.revision + 1,
                proposalId: result.id,
              });
            }
            break;
          }
          case "approve_edit":
            if (proposal(s).status !== "pending")
              throw new Error("Proposta não está pendente");
            proposal(s).status = "approved";
            proposal(s).approvedAt = now;
            result = proposal(s);
            break;
          case "apply_approved_edit": {
            const p = proposal(s);
            if (p.status !== "approved")
              throw new Error(
                "Laura precisa aprovar esta proposta na interface",
              );
            const c = need(s.chapters, p.chapterId);
            if (c.revision !== p.baseChapterRevision)
              throw Object.assign(
                new Error(
                  "Conflito: capítulo mudou; crie nova proposta sobre a versão atual",
                ),
                { statusCode: 409 },
              );
            if (p.afterLatex !== undefined) {
              c.latex = p.afterLatex;
              c.latexRevision = (c.latexRevision || 0) + 1;
              c.latexWarnings = projectLatex(p.afterLatex).warnings;
            }
            c.content = p.after;
            c.revision++;
            p.status = "applied";
            p.appliedAt = now;
            p.appliedVersion = s.revision + 1;
            p.operationId = operationId;
            result = p;
            break;
          }
          case "reject_edit_proposal":
            if (!["pending", "approved"].includes(proposal(s).status))
              throw new Error("Proposta já finalizada");
            proposal(s).status = "rejected";
            proposal(s).rejectedAt = now;
            if(proposal(s).commentId){const c=need(s.comments,proposal(s).commentId!);if(c.status==='open')c.reviewState='open';c.history?.push({at:now,action:'rejected',origin,version:s.revision+1,proposalId:proposal(s).id});}
            result = proposal(s);
            break;
          case "restore_version": {
            const old = this.store.version(a.version);
            const live = s.proposals;
            for (const key of [
              "name",
              "chapters",
              "comments",
              "notes",
              "references",
            ] as const)
              (s as any)[key] = old[key];
            for (const c of s.chapters)
              c.revision =
                Math.max(
                  c.revision,
                  need(
                    current.chapters.filter((x) => x.id === c.id).length
                      ? current.chapters
                      : [c],
                    c.id,
                  ).revision,
                ) + 1;
            s.proposals = live
              .map((p) =>
                p.status === "applied" && (p.appliedVersion || 0) > a.version
                  ? { ...p, status: "reverted" as const }
                  : p,
              )
              .filter(
                (p) =>
                  s.chapters.some((c) => c.id === p.chapterId) &&
                  (!p.commentId ||
                    s.comments.some((c) => c.id === p.commentId)),
              );
            result = { restoredFrom: a.version };
            break;
          }
          case "update_reference": {
            const ref=need(s.references,a.referenceId);if(origin==='mcp'&&a.verified!==undefined)throw new Error('Conferir uma fonte exige decisão na interface local');
            for(const key of ['title','authors','year','publication','doi','url','note','evidenceUrl','evidenceNote'] as const)if(a[key]!==undefined){ref[key]=a[key];ref.verified=false;}
            if(a.verified!==undefined)ref.verified=a.verified;ref.updatedAt=now;result=ref;break;
          }
          case "import_bibtex": {
            const entries=new Cite(a.source).data;if(!entries.length)throw new Error('Nenhuma entrada bibliográfica encontrada');const added:string[]=[],skipped:string[]=[];
            for(const r of entries){const key=String(r['citation-key']||r.id);if(s.references.some(x=>x.key===key)){if(a.onDuplicate==='error')throw new Error('Chave bibliográfica duplicada: '+key);skipped.push(key);continue;}if(!r.title)throw new Error('Referência sem título: '+key);s.references.push({id:randomUUID(),key,title:r.title,authors:(r.author||[]).map((x:any)=>[x.family,x.given].filter(Boolean).join(', ')).join('; '),year:String(r.issued?.['date-parts']?.[0]?.[0]||''),publication:r['container-title']||'',doi:r.DOI||'',url:/^https?:\/\//.test(r.URL||'')?r.URL:'',type:r.type||'article',note:'',bibtex:a.source,origin,createdAt:now,updatedAt:now,verified:false});added.push(key);}result={count:added.length,added,skipped};break;
          }
          case "add_reference":
            if(!a.key){const base=String(a.authors||a.title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,32).replace(/^-|-$/g,'');a.key=base+'-'+String(a.year||'sdata')+'-'+randomUUID().slice(0,6);}
            if (s.references.some((r) => r.key === a.key))
              throw new Error("Chave bibliográfica já existente");
            result = {
              id: randomUUID(),
              key: a.key,
              title: a.title,
              authors: a.authors || "",
              year: a.year || "",
              publication: a.publication || "",
              doi: a.doi || "",
              url: a.url || "",
              type: a.type || "article",
              note: a.note || "",
              bibtex: a.bibtex,
              origin,createdAt:now,updatedAt:now,evidenceUrl:a.evidenceUrl,evidenceNote:a.evidenceNote,verified:false,
            };
            s.references.push(result);
            break;
          case "update_settings":
            if (a.name) s.name = a.name;
            for (const k of [
              "mcpEnabled",
              "mcpWrite",
              "backupRetentionDays",
            ] as const)
              if (a[k] !== undefined) (s.settings as any)[k] = a[k];
            if (!s.settings.mcpEnabled) s.settings.mcpWrite = false;
            result = s.settings;
            break;
          default:
            throw new Error("Operação não implementada");
        }
      },
    );
    return {
      revision: next.revision,
      result,
      operationId: (
        this.store.db
          .prepare("SELECT operation_id FROM versions WHERE id=?")
          .get(next.revision) as any
      ).operation_id,
    };
  }
}
