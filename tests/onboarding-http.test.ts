import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

test("onboarding HTTP: protected UI writes, restart on another port, stale state and durable metadata", async () => {
  const root = mkdtempSync(join(tmpdir(), "laurex-onboarding-http-"));
  async function start() {
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
    const port = (socket.address() as any).port;
    await new Promise<void>((r) => socket.close(() => r()));
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "server/index.ts"],
      {
        env: { ...process.env, PORT: String(port), LAURA_DATA_DIR: root },
        stdio: "ignore",
      },
    );
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    const token = (await (await fetch(url + "/api/session")).json()).token;
    const get = async () => (await fetch(url + "/api/onboarding")).json();
    const post = (body: unknown, headers = {}) =>
      fetch(url + "/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Laura-Token": token,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    return {
      url,
      get,
      post,
      stop: async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const done = new Promise((r) => child.once("exit", r));
        child.kill("SIGTERM");
        await done;
      },
    };
  }
  let server: Awaited<ReturnType<typeof start>> | undefined;
  try {
    server = await start();
    const firstUrl = server.url;
    assert.equal(
      (
        await server.post(
          { expectedRevision: 0, event: "setup" },
          { "X-Laura-Token": "" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await server.post(
          { expectedRevision: 0, event: "setup" },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    let s = await server.get();
    assert.equal(s.status, "not_started");
    for (const event of ["setup", "start", "progress"]) {
      const r = await server.post({
        expectedRevision: s.revision,
        event,
        step: "comments",
      });
      assert.equal(r.status, 200);
      s = await r.json();
    }
    await server.stop();
    server = await start();
    assert.notEqual(server.url, firstUrl);
    s = await server.get();
    assert.equal(s.status, "in_progress");
    assert.equal(s.lastStep, "comments");
    const stale = s.revision;
    const completed = await server.post({
      expectedRevision: stale,
      event: "complete",
    });
    assert.equal(completed.status, 200);
    assert.equal(
      (
        await server.post({
          expectedRevision: stale,
          event: "progress",
          step: "ideas",
        })
      ).status,
      409,
    );
    await server.stop();
    server = await start();
    assert.equal((await server.get()).status, "completed");
  } finally {
    await server?.stop();
    rmSync(root, { recursive: true, force: true });
  }
});
