import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { createHash } from "node:crypto";
import { verifyBackupByRestore } from "../server/recovery";
import { Domain } from "../server/domain";
import { emptyDoc, paragraph, type Doc } from "../server/types";
import { hasDocumentContent } from "../server/chapter-status";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "laura-status-"));
  const store = new Store(root),
    domain = new Domain(store);
  const call = (tool: any, args: any = {}, origin = "ui") =>
    domain.call(
      tool,
      { expectedRevision: store.get().revision, ...args },
      origin,
    );
  return {
    root,
    store,
    call,
    close() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
const doc = (text: string): Doc => ({
  type: "doc",
  content: [paragraph(text)],
});
test("emptiness preserves meaningful atoms and ignores empty layout", () => {
  for (const content of [
    emptyDoc(),
    doc(" \n\t "),
    {
      type: "doc",
      content: [{ type: "heading", content: [] }, { type: "hardBreak" }],
    },
  ])
    assert.equal(hasDocumentContent(content), false);
  for (const type of [
    "image",
    "table",
    "inlineMath",
    "blockMath",
    "citation",
    "footnote",
    "rawLatex",
    "crossReference",
  ])
    assert.equal(
      hasDocumentContent({ type: "doc", content: [{ type }] }),
      true,
      type,
    );
});
test("first save promotes atomically, metadata does not; started persists after deletion and restore", () => {
  const f = fixture();
  try {
    let c = f.call("create_chapter", {
      title: "Only title",
      plan: "Planning",
    }).result;
    assert.equal(c.status, "Planejado");
    f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: c.revision,
      content: doc("  "),
    });
    const plannedVersion = f.store.get().revision;
    c = f.store.get().chapters[0];
    const before = f.store.get().revision;
    c = f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: c.revision,
      content: doc("First words"),
    }).result;
    assert.equal(c.status, "Em desenvolvimento");
    assert.equal(f.store.get().revision, before + 1);
    c = f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: c.revision,
      content: emptyDoc(),
    }).result;
    assert.throws(
      () =>
        f.call("update_chapter", {
          chapterId: c.id,
          chapterRevision: c.revision,
          status: "Planejado",
        }),
      /já foi iniciado/,
    );
    for (const status of ["Em revisão", "Concluído", "Em desenvolvimento"])
      c = f.call("update_chapter", {
        chapterId: c.id,
        chapterRevision: c.revision,
        status,
      }).result;
    f.call("restore_version", { version: plannedVersion });
    assert.equal(f.store.get().chapters[0].started, true);
    assert.equal(f.store.get().chapters[0].status, "Em desenvolvimento");
  } finally {
    f.close();
  }
});
test("creation, import commit and approved proposal promote in their own transaction", () => {
  const f = fixture();
  try {
    assert.equal(
      f.call("create_chapter", { title: "Native", latex: "Text" }).result
        .status,
      "Em desenvolvimento",
    );
    f.store.commit(f.store.get().revision, "import_docx", "ui", (s) => {
      s.chapters.push({
        id: "import",
        title: "Imported",
        status: "Planejado",
        parentId: null,
        plan: "",
        content: doc("Import"),
        revision: 1,
      });
    });
    assert.equal(f.store.get().chapters[1].status, "Em desenvolvimento");
    const c = f.call("create_chapter", { title: "Proposal" }).result;
    const p = f.call("propose_edit", {
      chapterId: c.id,
      chapterRevision: c.revision,
      after: doc("Proposed"),
      reason: "First text",
    }).result;
    f.call("approve_edit", { proposalId: p.id });
    f.call("apply_approved_edit", { proposalId: p.id });
    assert.equal(f.store.get().chapters[2].status, "Em desenvolvimento");
  } finally {
    f.close();
  }
});
test("completion acknowledgment is local, status-only, chapter-scoped and revision-bound", () => {
  const f = fixture();
  try {
    let c = f.call("create_chapter", {
      title: "A",
      content: doc("Text"),
    }).result;
    const other = f.call("create_chapter", {
      title: "B",
      content: doc("Other"),
    }).result;
    f.call("create_comment", { chapterId: other.id, body: "Other chapter" });
    c = f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: c.revision,
      status: "Concluído",
    }).result;
    c = f.call("update_chapter", {
      chapterId: c.id,
      chapterRevision: c.revision,
      status: "Em revisão",
    }).result;
    const comment = f.call("create_comment", {
      chapterId: c.id,
      body: "Pending",
    }).result;
    f.call("create_comment", { chapterId: c.id, body: "Resolved" });
    f.call("resolve_comment", { commentId: f.store.get().comments.at(-1)!.id });
    const args = {
      chapterId: c.id,
      chapterRevision: c.revision,
      status: "Concluído",
    };
    const revision = f.store.get().revision;
    assert.throws(() => f.call("update_chapter", args), /1 comentários/);
    assert.equal(f.store.get().revision, revision); // cancel is no mutation
    assert.throws(
      () =>
        f.call("update_chapter", {
          ...args,
          acknowledgeOpenComments: true,
          content: doc("Overwrite"),
        }),
      /somente o status/,
    );
    f.call("update_settings", { mcpEnabled: true, mcpWrite: true });
    assert.throws(
      () =>
        f.call(
          "update_chapter",
          { ...args, acknowledgeOpenComments: true },
          "mcp",
        ),
      /confirmação local/,
    );
    assert.throws(
      () =>
        f.call("update_chapter", {
          ...args,
          acknowledgeOpenComments: true,
          expectedRevision: revision,
        }),
      /mudou/,
    );
    assert.throws(() =>
      f.call("update_chapter", {
        ...args,
        chapterRevision: c.revision - 1,
        acknowledgeOpenComments: true,
      }),
    );
    const before = structuredClone(f.store.get());
    f.call("update_chapter", { ...args, acknowledgeOpenComments: true });
    const after = f.store.get();
    assert.equal(after.chapters[0].status, "Concluído");
    assert.deepEqual(after.comments, before.comments);
    assert.equal(
      after.comments.find((x) => x.id === comment.id)!.status,
      "open",
    );
    assert.deepEqual(after.chapters[0].content, before.chapters[0].content);
  } finally {
    f.close();
  }
});

test("legacy backup remains recoverable when planned content is promoted", async () => {
  const f = fixture();
  try {
    f.call("create_chapter", { title: "Legacy", content: doc("Existing academic text") });
    const file = f.store.backup();
    const envelope = JSON.parse(readFileSync(file, "utf8"));
    for (const state of [envelope.payload.state]) {
      delete state.chapters[0].started;
      state.chapters[0].status = "Planejado";
    }
    envelope.sha256 = createHash("sha256").update(JSON.stringify(envelope.payload)).digest("hex");
    writeFileSync(file, JSON.stringify(envelope));
    assert.equal(await verifyBackupByRestore(file), true);
  } finally { f.close(); }
});

test("startup migrates legacy status with backup and chapter revision increment", () => {
  const f = fixture();
  try {
    const c = f.call("create_chapter", { title: "Legacy", content: doc("Existing text") }).result;
    const legacy = f.store.get();
    delete legacy.chapters[0].started;
    legacy.chapters[0].status = "Planejado";
    f.store.db.prepare("UPDATE workspace SET json=? WHERE id=1").run(JSON.stringify(legacy));
    f.store.close();
    const migrated = new Store(f.root);
    try {
      assert.equal(migrated.get().chapters[0].status, "Em desenvolvimento");
      assert.equal(migrated.get().chapters[0].revision, c.revision + 1);
      assert.equal(migrated.get().chapters[0].started, true);
      assert.equal(migrated.get().revision, legacy.revision + 1);
    } finally { migrated.close(); }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
