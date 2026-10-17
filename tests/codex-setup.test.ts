import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Store } from "../server/store";
import {
  connectCodex,
  registerCodex,
  type RunCodex,
} from "../scripts/connect-codex";

test("local setup registers absolute transport, verifies real MCP, preserves content and is repeatable", async () => {
  const root = mkdtempSync(join(tmpdir(), "laura-codex-"));
  const store = new Store(root);
  let registration: any;
  const run: RunCodex = (args) => {
    if (args[1] === "list")
      return JSON.stringify(registration ? [registration] : []);
    if (args[1] === "get") return JSON.stringify(registration);
    assert.equal(args[1], "add");
    const marker = args.indexOf("--");
    registration = {
      name: "laura-workspace",
      enabled: true,
      transport: {
        command: args[marker + 1],
        args: args.slice(marker + 2),
        env: { LAURA_DATA_DIR: args[4].slice("LAURA_DATA_DIR=".length) },
      },
    };
    return "Added";
  };
  try {
    const before = store.get();
    const count = await connectCodex(run, store);
    assert.equal(count, 50);
    assert.deepEqual(store.get().chapters, before.chapters);
    assert.deepEqual(store.get().comments, before.comments);
    assert.equal(store.get().settings.mcpWrite, true);
    const revision = store.get().revision;
    await connectCodex(run, store);
    assert.equal(store.get().revision, revision);
    const record = JSON.parse(
      readFileSync(join(root, "setup/codex.json"), "utf8"),
    );
    assert.equal(record.protocolVerified, true);
    assert.equal(record.client, "codex-local");
    assert.equal(record.projectId, before.id);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("registration refuses another project's existing connection and detects unsuccessful configuration", () => {
  const transport = {
    command: process.execPath,
    args: ["source with spaces.ts"],
    env: { LAURA_DATA_DIR: join(tmpdir(), "target-project") },
  };
  let writes = 0;
  assert.throws(
    () =>
      registerCodex((args) => {
        if (args[1] !== "list") writes++;
        return JSON.stringify([
          {
            name: "laura-workspace",
            transport: {
              env: { LAURA_DATA_DIR: join(tmpdir(), "other-project") },
            },
          },
        ]);
      }, transport),
    /outra pasta/,
  );
  assert.equal(writes, 0);
  assert.throws(
    () =>
      registerCodex((args) => (args[1] === "list" ? "[]" : "{}"), transport),
    /não confirmou/,
  );
});
test("setup requires explicit local consent before creating any user data", () => {
  const root = mkdtempSync(join(tmpdir(), "laura-codex-consent-"));
  try {
    const data = join(root, "not-created");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/connect-codex.ts"],
      { encoding: "utf8", env: { ...process.env, LAURA_DATA_DIR: data } },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /allow-local-write/);
    assert.equal(existsSync(data), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
