import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Store } from "../server/store";
import { Domain, readonlyTools } from "../server/domain";
import { paragraph, plain, type Doc } from "../server/types";
import { importLatex, exportLatex } from "../server/documents";
import { readBackup, restoreBackup } from "../server/recovery";
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "laura-test-")),
    s = new Store(dir),
    d = new Domain(s);
  const call = (name: any, args: any = {}, origin = "ui") =>
    d.call(
      name,
      {
        ...(!readonlyTools.has(name)
          ? { expectedRevision: s.get().revision }
          : {}),
        ...args,
      },
      origin,
    );
  return { dir, s, d, call };
};
const content = (text: string): Doc => ({
  type: "doc",
  content: [paragraph(text)],
});
test("salva e reabre; rollback em falha; conflito preserva conteúdo", () => {
  const { dir, s, call } = setup();
  const c = call("create_chapter", {
    title: "Introdução",
    content: content("Texto original"),
  }).result;
  const revision = s.get().revision;
  assert.throws(() =>
    s.commit(revision, "failure", "test", (state) => {
      state.chapters = [];
      throw new Error("energia");
    }),
  );
  assert.equal(s.get().chapters.length, 1);
  call("update_chapter", {
    chapterId: c.id,
    chapterRevision: c.revision,
    content: content("Salvo"),
  });
  assert.throws(
    () =>
      call("update_chapter", {
        expectedRevision: revision,
        chapterId: c.id,
        chapterRevision: c.revision,
        content: content("Antigo"),
      }),
    /mudou/,
  );
  s.close();
  const reopen = new Store(dir);
  assert.equal(plain(reopen.get().chapters[0].content), "Salvo");
  assert.equal((reopen.verify().database[0] as any).integrity_check, "ok");
  reopen.close();
});
test("encerramento abrupto durante transação não confirma escrita parcial", () => {
  const { dir, s, call } = setup();
  call("create_chapter", { title: "Preservado" });
  s.close();
  const script = `import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(process.argv[1]);d.exec('BEGIN IMMEDIATE');d.prepare('UPDATE workspace SET json=?').run('{}');process.kill(process.pid,'SIGKILL');`;
  spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    script,
    join(dir, "workspace.sqlite"),
  ]);
  const recovered = new Store(dir);
  assert.equal(recovered.get().chapters[0].title, "Preservado");
  assert.equal((recovered.verify().database[0] as any).integrity_check, "ok");
  recovered.close();
});
test("comentário rastreável, proposta exige aprovação, resolve explicitamente e restaura", () => {
  const { s, call } = setup();
  const doc = content("Uma hipótese superficial."),
    c = call("create_chapter", { title: "Introdução", content: doc }).result;
  const comment = call("create_comment", {
    chapterId: c.id,
    body: "Aprofundar hipótese",
    quote: "hipótese",
    anchor: { blockId: doc.content![0].attrs!.id, scope: "selection" },
  }).result;
  const p = call("propose_edit", {
    chapterId: c.id,
    chapterRevision: 1,
    after: {
      ...doc,
      content: [
        {
          ...doc.content![0],
          content: [
            {
              type: "text",
              text: "Uma hipótese aprofundada com critérios explícitos.",
            },
          ],
        },
      ],
    },
    reason: "Responder à orientação",
    commentId: comment.id,
  }).result;
  assert.throws(
    () => call("apply_approved_edit", { proposalId: p.id }),
    /aprovar/,
  );
  call("approve_edit", { proposalId: p.id });
  const applied = call("apply_approved_edit", { proposalId: p.id });
  assert.equal(s.get().comments[0].status, "open");
  assert.equal(s.get().proposals[0].appliedVersion, applied.revision);
  const beforeResolve = s.get().revision;
  call("resolve_comment", { commentId: comment.id });
  call("reopen_comment", { commentId: comment.id });
  call("restore_version", { version: beforeResolve });
  assert.equal(s.get().comments[0].id, comment.id);
  assert.equal(s.get().comments[0].anchor.blockId, doc.content![0].attrs!.id);
  assert.equal(
    call("get_comment", { commentId: comment.id }).proposals.length,
    1,
  );
  s.close();
});
test("MCP desligado e escrita bloqueada; não pode aprovar nem restaurar", () => {
  const { s, call } = setup();
  assert.throws(() => call("get_project_info", {}, "mcp"), /desligada/);
  call("update_settings", { mcpEnabled: true });
  assert.throws(
    () => call("create_note", { content: "Teste" }, "mcp"),
    /não autorizada/,
  );
  call("update_settings", { mcpWrite: true });
  const c = call("create_chapter", { title: "Teste" }, "mcp").result;
  call("create_note", { content: "Ideia", chapterId: c.id }, "mcp");
  assert.equal(s.get().notes[0].origin, "mcp");
  assert.throws(
    () => call("approve_edit", { proposalId: "x" }, "mcp"),
    /interface local/,
  );
  assert.throws(
    () => call("restore_version", { version: 1 }, "mcp"),
    /interface local/,
  );
  assert.throws(
    () =>
      call(
        "update_chapter",
        { chapterId: c.id, chapterRevision: 1, content: content("Override") },
        "mcp",
      ),
    /propose_document_edit/,
  );
  assert.throws(
    () =>
      call(
        "create_note",
        { content: "bad", chapterId: "../../outside" },
        "mcp",
      ),
    /não encontrado/,
  );
  s.close();
});
test("backup validado por restauração recupera texto, notas e comentários sem apagar estado atual", () => {
  const { s, call } = setup();
  const c = call("create_chapter", {
    title: "Original",
    content: content("Texto protegido"),
  }).result;
  call("create_note", { content: "Ideia recuperável" });
  call("create_comment", { chapterId: c.id, body: "Orientação" });
  const file = s.backup();
  readBackup(file);
  call("update_chapter", {
    chapterId: c.id,
    chapterRevision: 1,
    content: content("Mudança"),
  });
  const before = s.get().revision;
  const r = restoreBackup(s, file);
  assert.ok(r.revision > before);
  assert.equal(plain(s.get().chapters[0].content), "Texto protegido");
  assert.equal(s.get().notes[0].content, "Ideia recuperável");
  assert.equal(s.get().comments[0].body, "Orientação");
  assert.ok(readFileSync(r.preserved).length > 0);
  const bad = join(s.root, "bad.json");
  writeFileSync(
    bad,
    readFileSync(file, "utf8").replace("Texto protegido", "Corrompido"),
  );
  assert.throws(() => restoreBackup(s, bad), /Checksum/);
  assert.equal(plain(s.get().chapters[0].content), "Texto protegido");
  s.close();
});
test("LaTeX complexo preservado byte a byte, conversão simples e comandos personalizados", () => {
  const original =
    "\\documentclass{abntex2}\n% nota\n\\newcommand{\\custom}{valor}\n\\begin{document}\n\\custom \\cite{silva2023}\\end{document}";
  const r = importLatex(original);
  assert.ok(r.warnings.length);
  assert.equal(exportLatex(r.doc), original);
  const simple = importLatex(
    "Texto com \\textbf{ênfase}.\n\nSegundo parágrafo.",
  );
  assert.equal(simple.warnings.length, 0);
  assert.match(exportLatex(simple.doc), /\\textbf\{ênfase\}/);
  assert.match(plain(simple.doc), /Segundo parágrafo/);
});
test("macro personalizada aninhada e citações com argumentos nunca são convertidas com perda", () => {
  for (const source of [
    "Texto \\textbf{com \\minhamacro{dado}}.",
    "\\cite[p. 12]{silva}",
    "Antes.\n\n\\subsection{Depois}\nConteúdo",
  ]) {
    const imported = importLatex(source);
    if (source.includes("minhamacro") || source.includes("[p.")) {
      assert.ok(imported.warnings.length);
      assert.equal(exportLatex(imported.doc), source);
    } else {
      assert.equal(imported.doc.content![0].type, "paragraph");
      assert.equal(imported.doc.content![1].type, "heading");
      assert.match(plain(imported.doc), /Antes/);
    }
  }
});
test("restaurar backup em instalação nova mantém todo o histórico navegável", () => {
  const a = setup();
  const c = a.call("create_chapter", {
    title: "Capítulo",
    content: content("V1"),
  }).result;
  a.call("update_chapter", {
    chapterId: c.id,
    chapterRevision: 1,
    content: content("V2"),
  });
  const backup = a.s.backup();
  const b = setup();
  const before = b.s.versions().length;
  restoreBackup(b.s, backup);
  assert.ok(b.s.versions().length >= before + a.s.versions().length);
  assert.ok(
    b.s
      .versions()
      .some((v: any) =>
        plain(b.s.version(v.id).chapters[0]?.content || content("")).includes(
          "V1",
        ),
      ),
  );
  assert.equal(plain(b.s.get().chapters[0].content), "V2");
  a.s.close();
  b.s.close();
});
test("âncoras sobrevivem a inserções próximas e detectam remoção ou ambiguidade", async () => {
  const { resolveAnchor } = await import("../server/anchors");
  const p = paragraph("Uma hipótese importante no trabalho.");
  const c: any = {
    quote: "hipótese",
    anchor: { blockId: p.attrs!.id, scope: "selection" },
  };
  const original = { type: "doc", content: [p] };
  assert.equal(resolveAnchor(original, c).status, "linked");
  const nearby = structuredClone(original);
  nearby.content[0].content![0].text =
    "Texto novo. Uma hipótese importante no trabalho.";
  assert.equal(resolveAnchor(nearby, c).status, "linked");
  nearby.content[0].content![0].text = "Uma hipótese e outra hipótese.";
  assert.equal(resolveAnchor(nearby, c).status, "orphan");
  const removed = { type: "doc", content: [paragraph("Outro conteúdo")] };
  assert.equal(resolveAnchor(removed, c).status, "orphan");
});
test("seleção com vários parágrafos mantém regiões estáveis", async () => {
  const { resolveAnchor } = await import("../server/anchors");
  const first = paragraph("Primeiro parágrafo."),
    second = paragraph("Segundo parágrafo.");
  const c: any = {
    quote: "parágrafo. Segundo",
    anchor: {
      blockId: first.attrs!.id,
      blockIds: [first.attrs!.id, second.attrs!.id],
      scope: "selection",
    },
  };
  const resolved = resolveAnchor({ type: "doc", content: [first, second] }, c);
  assert.equal(resolved.status, "linked");
  assert.equal(resolved.ranges.length, 2);
});
test("compilação visual rejeita comandos TeX ativos em expressões", async () => {
  const { safeMath } = await import("../server/export");
  assert.throws(
    () =>
      safeMath({
        type: "doc",
        content: [
          {
            type: "inlineMath",
            attrs: { latex: "\\csname input\\endcsname{secret}" },
          },
        ],
      }),
    /não permitido/,
  );
  safeMath({
    type: "doc",
    content: [
      { type: "inlineMath", attrs: { latex: "\\frac{a}{b} + \\alpha" } },
    ],
  });
});
