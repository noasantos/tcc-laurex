import { rm } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { unzipSync, strFromU8 } from "fflate";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { createProjectArchive } from "../server/archive";
import { readBackup } from "../server/recovery";

test("preparação assistida exige autorização explícita e registra somente consentimento local", () => {
  const root = mkdtempSync(join(tmpdir(), "laura-prepare-"));
  const directory = join(root, "data");
  try {
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ["--import", "tsx", resolve("scripts/prepare-assistant.ts"), ...args],
        {
          encoding: "utf8",
          env: { ...process.env, LAURA_DATA_DIR: directory },
        },
      );
    assert.equal(run().status, 1);
    assert.equal(existsSync(directory), false);
    const prepared = run("--allow-chatgpt-write");
    assert.equal(prepared.status, 0, prepared.stderr);
    const store = new Store(directory);
    try {
      assert.equal(store.get().settings.mcpEnabled, true);
      assert.equal(store.get().settings.mcpWrite, true);
      assert.ok(store.verify().backups.length);
    } finally {
      store.close();
    }
    const record = JSON.parse(
      readFileSync(join(directory, "setup", "assistant.json"), "utf8"),
    );
    assert.equal(record.chatgptAccountVerified, false);
    assert.equal(record.tunnelConfigured, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("ZIP solicitado ao assistente contém backup integral verificável, sem modificar o texto", async () => {
  const root = mkdtempSync(join(tmpdir(), "laura-archive-"));
  const store = new Store(root);
  try {
    const domain = new Domain(store);
    domain.call("create_note", {
      expectedRevision: store.get().revision,
      content: "Decisão preservada",
      category: "Decisão acadêmica",
    });
    const revision = store.get().revision;
    const result = await createProjectArchive(store);
    const files = unzipSync(readFileSync(result.localPath));
    assert.ok(files["workspace-backup.json"]);
    const recovered = join(root, "copied-backup.json");
    writeFileSync(recovered, files["workspace-backup.json"]);
    const backup = readBackup(recovered);
    assert.equal(backup.state.notes[0].content, "Decisão preservada");
    assert.ok(backup.versions.length);
    assert.equal(store.get().revision, revision);
    assert.match(strFromU8(files["LEIA-ME.txt"]), /fontes originais/);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("runtime religa somente o site do projeto, reutiliza processo e recusa outro diretório", async () => {
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as any).port;
  await new Promise<void>((r) => socket.close(() => r()));
  const oldPort = process.env.PORT;
  process.env.PORT = String(port);
  const root = mkdtempSync(join(tmpdir(), "laura-runtime-"));
  const store = new Store(root);
  store.close();
  let pid: number | undefined;
  try {
    const { workspaceRuntime, ensureWorkspaceRunning } =
      await import("../server/runtime");
    assert.equal((await workspaceRuntime(root)).running, false);
    const started = await ensureWorkspaceRunning(root);
    pid = started.pid;
    assert.equal(started.running, true);
    assert.equal(started.started, true);
    assert.ok(pid);
    assert.equal((await ensureWorkspaceRunning(root)).started, false);
    await assert.rejects(
      () => ensureWorkspaceRunning(join(root, "other-project")),
      /outra aplicação ou projeto/,
    );
  } finally {
    if (pid) {
      process.kill(pid, "SIGTERM");
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          process.kill(pid, 0);
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          break;
        }
      }
    }
    if (oldPort === undefined) delete process.env.PORT;
    else process.env.PORT = oldPort;
    // Windows may release inherited log/database handles shortly after process exit.
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 150,
    });
  }
});
