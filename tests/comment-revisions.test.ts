import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain, readonlyTools } from "../server/domain";
import { paragraph, type Proposal } from "../server/types";
import {
  comparisonRows,
  comparisonSource,
  comparisonText,
} from "../src/components/change-comparison";

test("comment revisions capture authoritative snapshots, require approval, retain history and never auto-complete", () => {
  const root = mkdtempSync(join(tmpdir(), "laura-comment-history-"));
  const store = new Store(root),
    domain = new Domain(store);
  const call = (tool: any, args: any = {}, origin = "ui") =>
    domain.call(
      tool,
      {
        ...(readonlyTools.has(tool)
          ? {}
          : { expectedRevision: store.get().revision }),
        ...args,
      },
      origin,
    );
  try {
    call("update_settings", { mcpEnabled: true, mcpWrite: true });
    const chapter = call("create_chapter", {
      title: "Revisão",
      latex: "Texto original.",
    }).result;
    const comment = call("create_comment", {
      chapterId: chapter.id,
      body: "Aprofundar",
      quote: "Texto original.",
      anchor: { scope: "chapter" },
    }).result;
    const args = {
      chapterId: chapter.id,
      chapterRevision: chapter.revision,
      commentId: comment.id,
      afterLatex: "Texto revisado com detalhes.",
      reason: "Aprofundamento",
    };
    assert.throws(() =>
      call("propose_edit", { ...args, beforeLatex: "Antes inventado" }, "mcp"),
    );
    const p = call("propose_edit", args, "mcp").result;
    assert.equal(p.beforeLatex, chapter.latex);
    assert.deepEqual(p.before, chapter.content);
    assert.equal(
      store.get().chapters.find((c) => c.id === chapter.id)!.latex,
      chapter.latex,
    );
    assert.throws(
      () => call("apply_approved_edit", { proposalId: p.id }, "mcp"),
      /aprovar/,
    );
    assert.throws(() => call("approve_edit", { proposalId: p.id }, "mcp"));
    call("approve_edit", { proposalId: p.id });
    call("apply_approved_edit", { proposalId: p.id }, "mcp");
    const context = call("get_comment", { commentId: comment.id }, "mcp");
    assert.equal(context.status, "open");
    assert.equal(context.proposals[0].afterLatex, args.afterLatex);
    assert.equal(context.proposals[0].beforeLatex, chapter.latex);
    assert.ok(context.proposals[0].operationId);
    assert.ok(
      context.history.some(
        (e: any) =>
          e.action === "applied" &&
          e.proposalId === p.id &&
          e.version === context.proposals[0].appliedVersion,
      ),
    );
    call("resolve_comment", { commentId: comment.id });
    assert.equal(
      call("get_comment", { commentId: comment.id }).status,
      "resolved",
    );
    call("reopen_comment", { commentId: comment.id });
    assert.equal(call("get_comment", { commentId: comment.id }).status, "open");
    assert.throws(() =>
      call("set_comment_state", { commentId: comment.id, state: "analyzing" }),
    );
    assert.throws(
      () =>
        call("resolve_comment", { commentId: comment.id, expectedRevision: 1 }),
      /projeto mudou/i,
    );
    const current = store.get().chapters.find((c) => c.id === chapter.id)!;
    const next = call(
      "propose_edit",
      { ...args, chapterRevision: current.revision },
      "mcp",
    ).result;
    call("approve_edit", { proposalId: next.id });
    call("update_chapter", {
      chapterId: chapter.id,
      chapterRevision: current.revision,
      latex: "Uma edição mais recente.",
    });
    assert.throws(
      () => call("apply_approved_edit", { proposalId: next.id }, "mcp"),
      /Conflito/,
    );
    assert.equal(
      store.get().chapters.find((c) => c.id === chapter.id)!.latex,
      "Uma edição mais recente.",
    );
    const elsewhere = call("create_chapter", { title: "Outro" }).result;
    assert.throws(
      () =>
        call(
          "propose_edit",
          {
            ...args,
            chapterId: elsewhere.id,
            chapterRevision: elsewhere.revision,
          },
          "mcp",
        ),
      /outro capítulo/,
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("comparison focuses changes with accurate line numbers and preserves non-text content", () => {
  const rows = comparisonRows(
    "a\nb\nc\nd\ne\nf\ng",
    "a\nb\nc\nNovo\ne\nf\ng",
    1,
  );
  assert.equal(rows[0].omitted, 2);
  const changed = rows.find((r) => r.changed)!;
  assert.deepEqual(changed, {
    before: "d",
    after: "Novo",
    oldLine: 4,
    newLine: 4,
    changed: true,
  });
  assert.equal(rows.at(-1)!.omitted, 2);
  assert.equal(comparisonRows("", "Novo")[0].after, "Novo");
  assert.deepEqual(comparisonRows("igual", "igual"), []);
  assert.match(
    comparisonText({
      type: "doc",
      content: [
        { type: "image", attrs: { alt: "Gráfico" } },
        { type: "footnote", attrs: { text: "Nota" } },
      ],
    }),
    /Gráfico.*\n.*Nota/,
  );
  const before = { type: "doc", content: [paragraph("Mesmo texto")] };
  const p = {
    before,
    after: before,
    beforeLatex: "Mesmo texto",
    afterLatex: "\\textbf{Mesmo texto}",
  } as Proposal;
  assert.equal(comparisonSource(p).sourceRequired, true);
});
