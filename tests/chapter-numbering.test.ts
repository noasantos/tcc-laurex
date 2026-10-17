import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { previewChapterPlacement } from "../server/chapter-numbering";
import { verifyBackupByRestore, readBackup } from "../server/recovery";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "laura-numbering-"));
  const store = new Store(root),
    domain = new Domain(store);
  return {
    root,
    store,
    call: (tool: any, args: any = {}) =>
      domain.call(tool, { expectedRevision: store.get().revision, ...args }),
    close() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test("chapter 6 may precede creation of 5; filling a gap preserves titles, sources and revisions", async () => {
  const f = fixture();
  try {
    const first = f.call("create_chapter", {
      title: "Introdução",
      number: 1,
      latex: "Fonte original.",
    }).result;
    const sixth = f.call("create_chapter", {
      title: "Conclusão",
      number: 6,
      latex: "Texto do sexto.",
    }).result;
    const fifth = f.call("create_chapter", {
      title: "Discussão",
      number: 5,
    }).result;
    assert.deepEqual(
      f.store.get().chapters.map((c) => [c.number, c.title]),
      [
        [1, "Introdução"],
        [5, "Discussão"],
        [6, "Conclusão"],
      ],
    );
    assert.equal(
      f.store.get().chapters.find((c) => c.id === sixth.id)!.revision,
      sixth.revision,
    );
    assert.equal(
      f.store.get().chapters.find((c) => c.id === first.id)!.latex,
      first.latex,
    );
    assert.equal(await verifyBackupByRestore(f.store.backup()), true);
    const occupied = f.call("create_chapter", {
      title: "Método",
      number: 5,
    }).result;
    assert.deepEqual(
      f.store.get().chapters.map((c) => [c.number, c.title]),
      [
        [1, "Introdução"],
        [5, "Método"],
        [6, "Discussão"],
        [7, "Conclusão"],
      ],
    );
    const current = f.store.get();
    assert.throws(
      () =>
        f.call("update_chapter", {
          chapterId: sixth.id,
          chapterRevision: sixth.revision,
          title: "Não sobrescrever",
        }),
      /mudou/,
    );
    assert.equal(f.store.get().revision, current.revision);
    assert.equal(occupied.title, "Método");
    assert.equal(fifth.title, "Discussão");
    assert.throws(() =>
      f.call("create_chapter", { title: "Inválido", number: 0 }),
    );
    assert.throws(
      () =>
        f.call("create_chapter", { title: "Ambíguo", number: 2, position: 0 }),
      /nunca ambos/,
    );
    assert.throws(
      () =>
        f.call("reorder_chapters", {
          ids: current.chapters.map((c) => c.id),
          expectedRevision: 1,
        }),
      /projeto mudou/,
    );
    const ids = current.chapters.map((c) => c.id).reverse();
    f.call("reorder_chapters", { ids });
    assert.deepEqual(
      f.store.get().chapters.map((c) => c.number),
      [1, 5, 6, 7],
    );
    assert.deepEqual(
      f.store.get().chapters.map((c) => c.id),
      ids,
    );
    assert.equal(
      f.store.get().chapters.find((c) => c.id === sixth.id)!.title,
      "Conclusão",
    );
  } finally {
    f.close();
  }
});
test("insertion absorbs the nearest gap and preview agrees with server", () => {
  const f = fixture();
  try {
    f.call("create_chapter", { title: "Quatro", number: 4 });
    f.call("create_chapter", { title: "Seis", number: 6 });
    const before = f.store.get();
    const preview = previewChapterPlacement(
      before.chapters,
      { id: "draft", title: "Novo" },
      4,
    );
    f.call("create_chapter", { title: "Novo", number: 4 });
    assert.deepEqual(
      f.store.get().chapters.map((c) => [c.number, c.title]),
      preview.map((c) => [c.number, c.title]),
    );
    assert.deepEqual(
      before.chapters.map((c) => c.number),
      [4, 6],
    );
    assert.deepEqual(
      preview.map((c) => c.number),
      [4, 5, 6],
    );
  } finally {
    f.close();
  }
});
test("legacy numeric titles are separated once, with backup and exact source preservation", async () => {
  const f = fixture();
  let reopened: Store | undefined;
  try {
    const a = f.call("create_chapter", {
      title: "Introdução",
      latex: "Texto \\textbf{preservado}.",
    }).result;
    const s = f.store.get();
    s.chapters[0].title = "1. Introdução";
    delete s.chapters[0].number;
    f.store.db
      .prepare("UPDATE workspace SET json=? WHERE id=1")
      .run(JSON.stringify(s));
    const old = f.store.backup();
    assert.equal(await verifyBackupByRestore(old), true);
    f.store.close();
    reopened = new Store(f.root);
    assert.equal(reopened.get().chapters[0].title, "Introdução");
    assert.equal(reopened.get().chapters[0].number, 1);
    assert.equal(reopened.get().chapters[0].latex, a.latex);
    assert.equal(readBackup(old).state.chapters[0].title, "1. Introdução");
    const current = reopened.get().revision;
    reopened.close();
    reopened = new Store(f.root);
    assert.equal(reopened.get().revision, current);
  } finally {
    reopened?.close();
    try {
      f.store.close();
    } catch {}
    rmSync(f.root, { recursive: true, force: true });
  }
});
