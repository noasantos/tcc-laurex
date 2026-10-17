import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
test("HTTP real: origem, sessão local, autenticação MCP e escrita pelo protocolo", async () => {
  const root = mkdtempSync(join(tmpdir(), "laura-http-"));
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as any).port;
  await new Promise<void>((r) => socket.close(() => r()));
  const url = `http://127.0.0.1:${port}`;
  const secret = crypto.randomUUID() + crypto.randomUUID();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        LAURA_DATA_DIR: root,
        PORT: String(port),
        LAURA_MCP_TOKEN: secret,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stderr.on("data", (b) => (logs += b));
  const client = new Client({ name: "http-test", version: "1" });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "/api/health")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, logs);
    assert.equal((await fetch(url + "/api/location/pick", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: "{}",
    })).status, 403, "Native dialogs require the authenticated local UI session");
    assert.equal(
      (
        await fetch(url + "/api/state", {
          headers: { Origin: "https://external.invalid" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/action/create_note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
    const { token } = await (await fetch(url + "/api/session")).json();
    const state = await (await fetch(url + "/api/state")).json();
    const preview = await fetch(url + "/api/latex-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Laura-Token": token },
      body: JSON.stringify({
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "A & B" }] },
          ],
        },
      }),
    });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).blocks[0].code, "A \\& B\n\n");
    assert.equal(
      (await (await fetch(url + "/api/state")).json()).revision,
      state.revision,
    );
    const enable = await fetch(url + "/api/action/update_settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Laura-Token": token },
      body: JSON.stringify({
        expectedRevision: state.revision,
        mcpEnabled: true,
        mcpWrite: true,
      }),
    });
    assert.equal(enable.status, 200);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
        requestInit: { headers: { Authorization: "Bearer " + secret } },
      }),
    );
    const info: any = await client.callTool({
      name: "get_project_info",
      arguments: {},
    });
    const revision = (info.structuredContent as any).result.revision;
    const write: any = await client.callTool({
      name: "create_note",
      arguments: {
        expectedRevision: revision,
        content: "Nota via HTTP autenticado",
      },
    });
    assert.ok(!write.isError, JSON.stringify(write));
    assert.equal(
      (await (await fetch(url + "/api/state")).json()).notes[0].content,
      "Nota via HTTP autenticado",
    );
    for (const source of ["Conteúdo importado.", " \n\n"]) {
      const beforeImport = await (await fetch(url + "/api/state")).json();
      const response = await fetch(url + "/api/import/latex", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Laura-Token": token },
        body: JSON.stringify({ expectedRevision: beforeImport.revision, name: "Import status", source }),
      });
      assert.equal(response.status, 200);
      const imported = await response.json();
      assert.equal(imported.result.status, source.trim() ? "Em desenvolvimento" : "Planejado");
      assert.equal(imported.revision, beforeImport.revision + 1);
    }
  } finally {
    await client.close();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise((r) => child.once("exit", r));
    }
    rmSync(root, { recursive: true, force: true });
  }
});
