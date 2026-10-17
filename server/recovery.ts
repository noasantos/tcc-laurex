import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Store, atomic } from "./store";
import type { State } from "./types";
import { validateDoc } from "./documents";
const uuid=z.uuid();const str=z.string();const revision=z.number().int().positive();
const stateSchema=z.object({
 id:uuid,name:str,revision,
 chapters:z.array(z.object({id:uuid,title:str,status:z.enum(['Planejado','Em desenvolvimento','Em revisão','Concluído']),parentId:uuid.nullable(),plan:str,content:z.json(),revision})),
 comments:z.array(z.object({id:uuid,chapterId:uuid,body:str,quote:str,anchor:z.object({blockId:str.optional(),blockIds:z.array(str).optional(),prefix:str.optional(),suffix:str.optional(),scope:str.optional()}),status:z.enum(['open','resolved']),author:str.optional(),reviewState:z.enum(['open','analyzing','proposed','resolved','reopened']).optional(),history:z.array(z.object({at:str,action:str,origin:str,version:revision,proposalId:uuid.optional()})).optional(),replies:z.array(z.object({body:str,at:str,origin:str})),createdAt:str,resolvedAt:str.optional()})),
 notes:z.array(z.object({id:uuid,title:str,content:str,category:str,chapterId:uuid.nullable(),state:str,origin:str,createdAt:str,updatedAt:str})),
 references:z.array(z.object({id:uuid,key:str,title:str,authors:str,year:str,publication:str,doi:str,url:str,type:str,note:str,bibtex:str.optional(),localPdfId:uuid.optional(),verified:z.boolean().optional(),origin:str.optional(),createdAt:str.optional(),updatedAt:str.optional(),evidenceUrl:str.optional(),evidenceNote:str.optional()})),
 proposals:z.array(z.object({id:uuid,chapterId:uuid,commentId:uuid.optional(),baseChapterRevision:revision,before:z.json(),after:z.json(),reason:str,status:z.enum(['pending','approved','applied','rejected','reverted']),createdAt:str,appliedVersion:revision.optional(),operationId:uuid.optional(),approvedAt:str.optional(),appliedAt:str.optional(),rejectedAt:str.optional()})),
 settings:z.object({mcpEnabled:z.boolean(),mcpWrite:z.boolean(),backupRetentionDays:z.number().int().min(0).optional()})
}).strict();
export function validateState(raw: unknown): State {
  const s = stateSchema.parse(raw) as unknown as State;
  const ids = new Set(s.chapters.map((c) => c.id));
  if (ids.size !== s.chapters.length) throw new Error("Capítulos duplicados");
  for (const c of s.chapters) {
    validateDoc(c.content);
    if (c.parentId && !ids.has(c.parentId))
      throw new Error("Capítulo principal ausente");
    const seen = new Set([c.id]);
    let p = c.parentId;
    while (p) {
      if (seen.has(p)) throw new Error("Ciclo na estrutura");
      seen.add(p);
      p = s.chapters.find((c) => c.id === p)?.parentId || null;
    }
  }
  for (const collection of [s.comments, s.notes, s.proposals, s.references]) {
    if (new Set(collection.map((x) => x.id)).size !== collection.length)
      throw new Error("IDs duplicados");
  }
  for (const entity of [...s.comments, ...s.notes, ...s.proposals])
    if (entity.chapterId && !ids.has(entity.chapterId))
      throw new Error("Vínculo acadêmico inválido");
  for (const p of s.proposals) {
    validateDoc(p.before);
    validateDoc(p.after);
    if (p.commentId && !s.comments.some((c) => c.id === p.commentId))
      throw new Error("Comentário de proposta inexistente");
  }
  return s;
}
export function readBackup(file: string) {
  const envelope = JSON.parse(readFileSync(file, "utf8"));
  const json = JSON.stringify(envelope.payload);
  if (createHash("sha256").update(json).digest("hex") !== envelope.sha256)
    throw new Error("Checksum do backup inválido; nenhum dado foi alterado");
  if (envelope.payload.format !== "laura-backup-v1")
    throw new Error("Formato de backup desconhecido");
  z.object({format:z.literal('laura-backup-v1'),state:z.unknown(),versions:z.array(z.object({id:revision,created_at:str,operation_id:uuid,origin:str,action:str,json:str,checksum:z.string().regex(/^[a-f0-9]{64}$/)})),sources:z.array(z.object({id:uuid,name:str,content:str,checksum:z.string().regex(/^[a-f0-9]{64}$/)})),audit:z.array(z.object({id:uuid,at:str,tool:str,outcome:str,revision})).optional()}).parse(envelope.payload);
  validateState(envelope.payload.state);
  for(const ref of envelope.payload.state.references)if(ref.localPdfId&&!envelope.payload.sources.some((source:any)=>source.id===ref.localPdfId))throw new Error('PDF de referência ausente no backup');
  for (const v of envelope.payload.versions) {
    if (createHash("sha256").update(v.json).digest("hex") !== v.checksum)
      throw new Error("Versão corrompida no backup");
    validateState(JSON.parse(v.json));
  }
  for (const source of envelope.payload.sources) {
    if (
      createHash("sha256")
        .update(Buffer.from(source.content, "base64"))
        .digest("hex") !== source.checksum
    )
      throw new Error("Original corrompido");
  }
  return envelope.payload;
}
export function restoreBackup(store: Store, file: string) {
  const payload = readBackup(file);
  const preserved = store.backup();
  const current = store.get();
  let nextId = current.revision;
  const mapping = new Map<number, number>();
  const imports: any[] = [];
  for (const v of payload.versions) {
    const existing = store.db
      .prepare("SELECT id FROM versions WHERE operation_id=?")
      .get(v.operation_id) as any;
    if (existing) mapping.set(v.id, existing.id);
    else {
      mapping.set(v.id, ++nextId);
      imports.push(v);
    }
  }
  const remap = (raw: any, revision: number) => {
    const s = structuredClone(raw);
    s.revision = revision;
    for (const p of s.proposals)
      if (p.appliedVersion)
        p.appliedVersion = mapping.get(p.appliedVersion) || p.appliedVersion;
    return s;
  };
  const state = store.commit(
    current.revision,
    "restore_backup",
    "recovery",
    (s) => {
      for (const audit of payload.audit || [])
        store.db
          .prepare("INSERT OR IGNORE INTO audit VALUES(?,?,?,?,?)")
          .run(audit.id, audit.at, audit.tool, audit.outcome, audit.revision);
      for (const source of payload.sources) {
        const old = store.db
          .prepare("SELECT checksum FROM sources WHERE id=?")
          .get(source.id) as any;
        if (old && old.checksum !== source.checksum)
          throw new Error("Conflito de original preservado");
        if (!old)
          store.db
            .prepare("INSERT INTO sources VALUES(?,?,?,?)")
            .run(
              source.id,
              source.name,
              Buffer.from(source.content, "base64"),
              source.checksum,
            );
      }
      for (const v of imports) {
        const id = mapping.get(v.id)!;
        const json = JSON.stringify(remap(JSON.parse(v.json), id));
        store.db
          .prepare("INSERT INTO versions VALUES(?,?,?,?,?,?,?)")
          .run(
            id,
            v.created_at,
            v.operation_id,
            v.origin,
            "recovered: " + v.action,
            json,
            createHash("sha256").update(json).digest("hex"),
          );
      }
      Object.assign(s, remap(payload.state, nextId), {
        id: current.id,
        settings: {
          ...payload.state.settings,
          mcpEnabled: false,
          mcpWrite: false,
        },
      });
      for (const c of s.chapters)
        c.revision =
          Math.max(
            c.revision,
            current.chapters.find((x) => x.id === c.id)?.revision || 0,
          ) + 1;
    },
  );
  return { preserved, revision: state.revision, recoveredHistory: true };
}
export async function verifyBackupByRestore(file: string) {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = mkdtempSync(join(tmpdir(), "laura-verify-"));
  let target: Store | undefined;
  try {
    const payload = readBackup(file);
    target = new Store(root);
    restoreBackup(target, file);
    const restored = target.get();
    for (const key of ["chapters", "comments", "notes", "references"] as const)
      if (
        JSON.stringify(
          key === "chapters"
            ? restored.chapters.map(({ revision, ...c }) => c)
            : restored[key],
        ) !==
        JSON.stringify(
          key === "chapters"
            ? payload.state.chapters.map(({ revision, ...c }: any) => c)
            : payload.state[key],
        )
      )
        throw new Error("Backup não passou na restauração de " + key);
    if ((target.verify().database[0] as any).integrity_check !== "ok")
      throw new Error("Backup não passou na integridade SQLite");
    return true;
  } finally {
    target?.close();
    rmSync(root, { recursive: true, force: true });
  }
}
