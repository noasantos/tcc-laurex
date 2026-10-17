import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { emptyDoc, paragraph } from "../server/types";
import { restoreBackup } from "../server/recovery";
import { academicPackage } from "../server/export";
import { unzipSync, strFromU8 } from "fflate";

const original = String.raw`% observação editorial
\section{Método}
\newcommand{\hipotese}[1]{#1}
Texto com \hipotese{conteúdo} e \cite{fonte_real}.
\begin{equation}
  \eta_t = \frac{1}{t}
\end{equation}
`;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "laura-native-"));
  const store = new Store(root),
    domain = new Domain(store);
  const call = (name: any, args: any = {}, origin = "ui") =>
    domain.call(
      name,
      { expectedRevision: store.get().revision, ...args },
      origin,
    );
  return {
    root,
    store,
    domain,
    call,
    close: () => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test("TeX nativo mantém bytes, macros, equações e comentários após leitura, metadados, backup e reabertura", () => {
  const f = fixture();
  try {
    const chapter = f.call("create_chapter", {
      title: "Método",
      latex: original,
    }).result;
    const file = join(f.root, "academic", "chapters", chapter.id + ".tex");
    assert.equal(chapter.latex, original);
    f.call("update_chapter", {
      chapterId: chapter.id,
      chapterRevision: 1,
      title: "Metodologia",
    });
    assert.equal(f.store.get().chapters[0].latex, original);
    assert.equal(readFileSync(file, "utf8"), original);
    assert.equal(
      strFromU8(unzipSync(academicPackage(f.store.get()))["chapter-01.tex"]),
      original,
    );
    const backup = f.store.backup();
    f.call("update_chapter", {
      chapterId: chapter.id,
      chapterRevision: 2,
      latex: original + "\nNova versão.",
    });
    restoreBackup(f.store, backup);
    assert.equal(f.store.get().chapters[0].latex, original);
    writeFileSync(file, "cópia danificada");
    const reopened = new Store(f.root);
    assert.equal(reopened.get().chapters[0].latex, original);
    assert.equal(readFileSync(file, "utf8"), original);
    reopened.close();
  } finally {
    f.close();
  }
});
test("revisão MCP de fonte exige aprovação, detecta conflito e não resolve comentário automaticamente", () => {
  const f = fixture();
  try {
    f.call("update_settings", { mcpEnabled: true, mcpWrite: true });
    const c = f.call(
      "create_chapter",
      { title: "Método", latex: original },
      "mcp",
    ).result;
    const comment = f.call("create_comment", {
      chapterId: c.id,
      body: "Revisar a hipótese",
    }).result;
    const next = original.replace("conteúdo", "conteúdo revisto");
    const p = f.call(
      "propose_edit",
      {
        chapterId: c.id,
        chapterRevision: 1,
        afterLatex: next,
        commentId: comment.id,
        reason: "Revisão",
      },
      "mcp",
    ).result;
    assert.equal(f.store.get().chapters[0].latex, original);
    assert.equal(p.beforeLatex, original);
    assert.throws(
      () => f.call("approve_edit", { proposalId: p.id }, "mcp"),
      /interface local/,
    );
    assert.throws(
      () => f.call("apply_approved_edit", { proposalId: p.id }, "mcp"),
      /aprovar/,
    );
    f.call("approve_edit", { proposalId: p.id });
    f.call("apply_approved_edit", { proposalId: p.id }, "mcp");
    assert.equal(f.store.get().chapters[0].latex, next);
    assert.equal(f.store.get().comments[0].status, "open");
    const stale = f.call(
      "propose_edit",
      {
        chapterId: c.id,
        chapterRevision: 2,
        afterLatex: original,
        reason: "Conflito",
      },
      "mcp",
    ).result;
    f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: 2,
      title: "Novo título",
    });
    f.call("approve_edit", { proposalId: stale.id });
    assert.throws(
      () => f.call("apply_approved_edit", { proposalId: stale.id }, "mcp"),
      /Conflito/,
    );
    assert.equal(f.store.get().chapters[0].latex, next);
    assert.throws(
      () =>
        f.call(
          "update_chapter",
          { chapterId: c.id, chapterRevision: 3, latex: original },
          "mcp",
        ),
      /propose_document_edit/,
    );
    assert.throws(
      () =>
        f.call("update_chapter", {
          chapterId: c.id,
          chapterRevision: 3,
          content: emptyDoc(),
        }),
      /construções protegidas/,
    );
    assert.equal(f.store.get().chapters[0].latex, next);
  } finally {
    f.close();
  }
});
test("capítulo legado ganha fonte sem substituir sua estrutura e sem perder a versão anterior", () => {
  const f = fixture();
  try {
    const c = f.call("create_chapter", {
      title: "Introdução",
      content: { type: "doc", content: [paragraph("Texto já existente.")] },
    }).result;
    const state = f.store.get();
    delete state.chapters[0].latex;
    f.store.db
      .prepare("UPDATE workspace SET json=? WHERE id=1")
      .run(JSON.stringify(state));
    const reopened = new Store(f.root);
    assert.match(reopened.get().chapters[0].latex!, /Texto já existente/);
    assert.deepEqual(reopened.get().chapters[0].content, c.content);
    assert.equal(
      reopened.version(state.revision).chapters[0].title,
      "Introdução",
    );
    reopened.close();
  } finally {
    f.close();
  }
});
test("edição visual atualiza TeX e preserva identidade de parágrafo quando o fonte é revisado", () => {
  const f = fixture();
  try {
    const c = f.call("create_chapter", {
      title: "Texto",
      latex: "Parágrafo preservado.\n\n",
    }).result;
    const id = c.content.content[0].attrs.id;
    f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: 1,
      latex: "Novo parágrafo.\n\nParágrafo preservado.\n\n",
    });
    const updated = f.store.get().chapters[0];
    assert.equal(updated.content.content?.[1].attrs?.id, id);
    f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: 2,
      content: {
        type: "doc",
        content: [paragraph("Texto editado visualmente.")],
      },
    });
    assert.match(f.store.get().chapters[0].latex!, /Texto editado visualmente/);
  } finally {
    f.close();
  }
});

test("inserção de capítulo é atômica, independente e respeita posição sem renomear os existentes", () => {
  const f = fixture();
  try {
    const a = f.call("create_chapter", { title: "Introdução" }).result;
    const b = f.call("create_chapter", { title: "Conclusão" }).result;
    const c = f.call("create_chapter", {
      title: "Metodologia",
      position: 1,
    }).result;
    assert.deepEqual(
      f.store.get().chapters.map((c) => c.id),
      [a.id, c.id, b.id],
    );
    assert.equal(c.parentId, null);
    assert.throws(
      () => f.call("create_chapter", { title: "Inválido", position: 9 }),
      /Posição/,
    );
    assert.deepEqual(
      f.store.get().chapters.map((c) => c.id),
      [a.id, c.id, b.id],
    );
  } finally {
    f.close();
  }
});

test("projeção nativa mostra equações e preserva comentários sem permitir uma conversão visual destrutiva", () => {
  const f = fixture();
  try {
    const latex = String.raw`% preservado
\section{Método}
Texto com $x_t$.

\begin{equation}
\eta_t = \frac{1}{t}
\end{equation}
`;
    const c = f.call("create_chapter",{title:"Método",latex}).result;
    assert.equal(c.latex,latex);
    assert.ok(c.content.content.some((b:any)=>b.type === "blockMath"));
    assert.equal(c.content.content.some((b:any)=>b.type === "rawLatex"),false);
    assert.ok(c.latexWarnings.length);
    assert.throws(()=>f.call("update_chapter",{chapterId:c.id,chapterRevision:1,content:emptyDoc()}),/protegidas/);
    f.call("update_chapter",{chapterId:c.id,chapterRevision:1,latex});
    assert.equal(f.store.get().chapters[0].latex,latex);
  } finally {f.close();}
});

test("figuras visuais de capítulos distintos mantêm caminhos próprios no fonte e no pacote acadêmico", () => {
  const f = fixture();
  try {
    for (const title of ["Capítulo A","Capítulo B"])
      f.call("create_chapter",{title,content:{type:"doc",content:[{type:"image",attrs:{src:"data:image/png;base64,aGVsbG8=",title}}]}});
    const files = unzipSync(academicPackage(f.store.get()));
    for (const [i,c] of f.store.get().chapters.entries()) {
      const path = `figures/${c.id}/figure-1.png`;
      assert.ok(c.latex?.includes(path));
      assert.equal(strFromU8(files[`chapter-0${i+1}.tex`]),c.latex);
      assert.ok(files[path]);
      assert.ok(readFileSync(join(f.root,"academic","chapters",path)).length);
    }
  } finally {f.close();}
});

test("verificação de backup anterior ao fonte nativo aceita a migração sem perder conteúdo", async () => {
  const f = fixture();
  try {
    f.call("create_chapter",{title:"Legado",content:{type:"doc",content:[paragraph("Preservar texto.")]}});
    const state = f.store.get();
    for (const c of state.chapters) {delete c.latex;delete c.latexRevision;delete c.latexWarnings;}
    f.store.db.prepare("UPDATE workspace SET json=? WHERE id=1").run(JSON.stringify(state));
    const backup = f.store.backup();
    const {verifyBackupByRestore} = await import("../server/recovery");
    assert.equal(await verifyBackupByRestore(backup),true);
  } finally {f.close();}
});
