import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain, readonlyTools } from "../server/domain";
import { readBackup, verifyBackupByRestore } from "../server/recovery";
import { selectComments } from "../src/components/comment-filters";
import type { Comment } from "../server/types";
test("comment and reply attribution is independent of transport and survives recovery", async () => {
  const root = mkdtempSync(join(tmpdir(), "laura-author-"));
  const store = new Store(root),
    d = new Domain(store);
  const call = (name: any, args: any = {}, origin = "ui") =>
    d.call(
      name,
      {
        ...(readonlyTools.has(name)
          ? {}
          : { expectedRevision: store.get().revision }),
        ...args,
      },
      origin,
    );
  try {
    call("update_settings", { mcpEnabled: true, mcpWrite: true });
    const c = call("create_chapter", { title: "Revisão" }).result;
    const human = call("create_comment", {
      chapterId: c.id,
      body: "Minha orientação",
    }).result;
    const ai = call(
      "create_comment",
      { chapterId: c.id, body: "Avaliação do texto" },
      "mcp",
    ).result;
    const dictated = call(
      "create_comment",
      { chapterId: c.id, body: "Registrar o que Laura pediu", author: "Laura" },
      "mcp",
    ).result;
    assert.equal(human.author, "Laura");
    assert.equal(human.origin, "ui");
    assert.equal(ai.author, "ChatGPT");
    assert.equal(dictated.author, "Laura");
    assert.equal(dictated.origin, "mcp");
    call(
      "reply_to_comment",
      { commentId: dictated.id, body: "Resposta ditada", author: "Laura" },
      "mcp",
    );
    call(
      "reply_to_comment",
      { commentId: dictated.id, body: "Minha análise" },
      "mcp",
    );
    call("reply_to_comment", {
      commentId: dictated.id,
      body: "Minha resposta pela interface",
    });
    const context = call("get_comment", { commentId: dictated.id });
    assert.deepEqual(
      context.replies.map((r: any) => [r.author, r.origin]),
      [
        ["Laura", "mcp"],
        ["ChatGPT", "mcp"],
        ["Laura", "ui"],
      ],
    );
    assert.equal(context.status, "open");
    assert.throws(() =>
      call(
        "create_comment",
        { chapterId: c.id, body: "Não inventar autor", author: "Outra pessoa" },
        "mcp",
      ),
    );
    const backup = store.backup();
    const recovered = readBackup(backup).state.comments.find(
      (x: any) => x.id === dictated.id,
    );
    assert.equal(recovered.author, "Laura");
    assert.equal(recovered.origin, "mcp");
    assert.equal(recovered.replies[0].author, "Laura");
    assert.equal(await verifyBackupByRestore(backup), true);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("comment filters count within scope and sort without changing the source list", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  const comments = [
    {
      id: "first",
      chapterId: "a",
      author: "Laura",
      body: "Revisão bibliográfica",
      quote: "",
      status: "open",
      createdAt: "2026-10-16T12:00:00Z",
      replies: [],
    },
    {
      id: "second",
      chapterId: "a",
      author: "ChatGPT",
      body: "Avaliação",
      quote: "",
      status: "resolved",
      createdAt: "2026-10-17T11:00:00Z",
      replies: [{ body: "Ver fonte", origin: "mcp", at: "2026-10-17" }],
    },
    {
      id: "third",
      chapterId: "b",
      author: "Laura",
      body: "Antiga",
      quote: "",
      status: "open",
      createdAt: "2026-09-01T12:00:00Z",
      replies: [],
    },
  ] as Comment[];
  const base = {
    chapterId: "",
    author: "",
    period: "",
    sort: "newest",
    query: "",
  };
  const all = selectComments(comments, base, now);
  assert.deepEqual([all.all, all.open, all.resolved], [3, 2, 1]);
  assert.deepEqual(
    all.comments.map((c) => c.id),
    ["second", "first", "third"],
  );
  assert.equal(comments[0].id, "first");
  assert.equal(
    selectComments(
      comments,
      { ...base, chapterId: "a", author: "Laura", query: "revisao" },
      now,
    ).all,
    1,
  );
  assert.equal(
    selectComments(comments, { ...base, period: "week" }, now).all,
    2,
  );
  assert.equal(
    selectComments(comments, { ...base, query: "fonte" }, now).resolved,
    1,
  );
  assert.equal(
    selectComments(comments, { ...base, sort: "oldest" }, now).comments[0].id,
    "third",
  );
});
