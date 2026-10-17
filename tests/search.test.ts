import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { paragraph } from "../server/types";
import { searchProject } from "../src/search";
test("pesquisa local encontra trechos, planejamento, respostas, notas e fontes sem diferenciar acentos", () => {
  const root = mkdtempSync(join(tmpdir(), "laura-search-"));
  const store = new Store(root);
  const domain = new Domain(store);
  const call = (name: any, args: any) =>
    domain.call(name, { expectedRevision: store.get().revision, ...args });
  try {
    const chapter = call("create_chapter", {
      title: "Introdução",
      plan: "Investigar hipótese editorial",
      content: {
        type: "doc",
        content: [paragraph("Esta investigação adota uma revisão crítica.")],
      },
    }).result;
    const comment = call("create_comment", {
      chapterId: chapter.id,
      body: "Aprofundar o argumento",
    }).result;
    call("reply_to_comment", {
      commentId: comment.id,
      body: "A hipótese requer evidências",
    });
    const note = call("create_note", {
      title: "Decisão sobre método",
      content: "Priorizar análise documental",
      category: "Decisão acadêmica",
    }).result;
    const reference = call("add_reference", {
      title: "Fonte verificada",
      authors: "Autora Exemplo",
      doi: "10.0000/example",
    }).result;
    assert.equal(
      searchProject(store.get(), "REVISAO CRITICA")[0].id,
      chapter.id,
    );
    assert.ok(
      searchProject(store.get(), "hipotese editorial").some(
        (r) => r.id === chapter.id,
      ),
    );
    assert.ok(
      searchProject(store.get(), "hipotese evidencias").some(
        (r) => r.id === comment.id,
      ),
    );
    assert.ok(
      searchProject(store.get(), "analise documental").some(
        (r) => r.id === note.id,
      ),
    );
    assert.equal(
      searchProject(store.get(), "autora exemplo")[0].id,
      reference.id,
    );
    assert.equal(
      searchProject(store.get(), "10.0000/example")[0].kind,
      "reference",
    );
    assert.deepEqual(searchProject(store.get(), "   "), []);
    assert.deepEqual(searchProject(store.get(), "inexistente999"), []);
    call("update_note", { noteId: note.id, state: "Arquivada" });
    assert.ok(
      !searchProject(store.get(), "analise documental").some(
        (r) => r.id === note.id,
      ),
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
