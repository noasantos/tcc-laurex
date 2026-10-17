import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { paragraph } from "../server/types";
import { commentReference } from "../server/comment-reference";
const root = mkdtempSync(join(tmpdir(), "laura-mcp-poc-"));
const store = new Store(root);
const domain = new Domain(store);
domain.call("update_settings", {
  expectedRevision: store.get().revision,
  mcpEnabled: true,
  mcpWrite: true,
});
const client = new Client({ name: "laura-protocol-proof", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", resolve("server/stdio.ts")],
  env: { ...(process.env as Record<string, string>), LAURA_DATA_DIR: root },
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((t) => t.name === "create_note"));
  const call = async (name: string, args: any = {}) => {
    const result: any = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(result.content[0].text);
    return result.structuredContent.result;
  };
  const revision = () => store.get().revision;
  domain.call("update_settings", {
    expectedRevision: revision(),
    mcpWrite: false,
  });
  await assert.rejects(
    () => call("ensure_workspace_running"),
    /Escrita MCP não autorizada/,
  );
  await assert.rejects(
    () => call("create_project_archive"),
    /Escrita MCP não autorizada/,
  );
  domain.call("update_settings", {
    expectedRevision: revision(),
    mcpWrite: true,
  });
  const info = await call("get_project_info");
  const runtime = await call("get_workspace_runtime");
  assert.equal(typeof runtime.running, "boolean");
  const archive = await call("create_project_archive");
  assert.ok(archive.filename.endsWith(".zip"));
  const chapter = (
    await call("create_chapter", {
      expectedRevision: info.revision,
      title: "Prova de leitura e escrita",
      content: { type: "doc", content: [paragraph("Texto para revisar.")] },
    })
  ).result;
  const read = await call("get_chapter", { chapterId: chapter.id });
  const source = (
    await call("create_reference", {
      expectedRevision: revision(),
      title: "Add custom MCP server",
      authors: "OpenAI",
      url: "https://developers.openai.com/api/docs/guides/custom-mcp-server",
      evidenceUrl:
        "https://developers.openai.com/api/docs/guides/custom-mcp-server",
      evidenceNote: "Official documentation inspected during setup.",
    })
  ).result;
  assert.ok(source.key);
  assert.equal(source.origin, "mcp");
  await call("update_reference", {
    expectedRevision: revision(),
    referenceId: source.id,
    note: "Documentação oficial para configurar a conexão privada.",
  });
  const bibliography = await call("import_bibtex", {
    expectedRevision: revision(),
    source:
      "@misc{openai_tunnel,title={Secure MCP Tunnel},author={{OpenAI}},url={https://developers.openai.com/api/docs/guides/secure-mcp-tunnels}}",
  });
  assert.equal(bibliography.result.count, 1);

  assert.equal(read.title, chapter.title);
  await call("create_note", {
    expectedRevision: revision(),
    content: "Nota escrita pelo protocolo MCP",
    chapterId: chapter.id,
  });
  const comment = (
    await call("create_comment", {
      expectedRevision: revision(),
      chapterId: chapter.id,
      body: "Aprofundar",
      quote: "Texto",
      anchor: { blockId: read.content.content[0].attrs.id, scope: "selection" },
    })
  ).result;
  const commentContext = await call("get_comment_context", {
    commentId: commentReference(comment.id),
  });
  assert.equal(commentContext.id, comment.id);
  assert.equal(commentContext.project.id, info.id);
  assert.equal(commentContext.chapter.id, chapter.id);
  assert.equal(commentContext.quote, "Texto");
  assert.equal(commentContext.currentExcerpt, "Texto");
  assert.ok(
    (await call("list_comments", { query: commentReference(comment.id) })).some(
      (c: any) => c.id === comment.id,
    ),
  );
  const proposal = (
    await call("propose_document_edit", {
      expectedRevision: revision(),
      chapterId: chapter.id,
      chapterRevision: 1,
      commentId: comment.id,
      reason: "Revisão rastreável",
      after: { type: "doc", content: [paragraph("Texto aprofundado.")] },
    })
  ).result;
  const denied: any = await client.callTool({
    name: "apply_approved_edit",
    arguments: { expectedRevision: revision(), proposalId: proposal.id },
  });
  assert.equal(denied.isError, true);
  domain.call("approve_edit", {
    expectedRevision: revision(),
    proposalId: proposal.id,
  });
  await call("apply_approved_edit", {
    expectedRevision: revision(),
    proposalId: proposal.id,
  });
  assert.equal(store.get().proposals[0].status, "applied");
  assert.equal(store.get().comments[0].status, "open");
  console.log(
    JSON.stringify(
      {
        protocol: "MCP stdio official SDK",
        read: true,
        createReference: true,
        updateReference: true,
        importBibtex: true,
        sourceProvenance: true,
        runtimeStatus: true,
        projectArchive: true,
        write: true,
        tools: tools.tools.length,
        unauthorizedApplyBlocked: true,
        approvedApply: true,
        commentNotAutoResolved: true,
        copiedCommentReference: true,
        chatgptAccountVerified: false,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
  store.close();
  const { rmSync } = await import("node:fs");
  rmSync(root, { recursive: true, force: true });
}
