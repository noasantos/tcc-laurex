import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { Store } from "../server/store";
import { readBackup, verifyBackupByRestore } from "../server/recovery";
import {
  AutomaticBackups,
  backupPolicy,
  retainedAutomaticBackups,
  type AutomaticBackupEntry,
} from "../server/automatic-backups";
const hour = 3600000,
  day = 24 * hour;
function setup(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "laura-auto-policy-"));
  const store = new Store(root);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  let time = Date.parse("2026-09-01T12:00:00.000Z");
  const clock = () => new Date(time);
  const advance = (ms: number) => {
    time += ms;
  };
  const change = () =>
    store.commit(store.get().revision, "edit", "ui", (s) => {
      s.name = "Projeto " + s.revision;
    });
  const files = () =>
    readdirSync(store.backups)
      .filter((f) => f.startsWith("auto-") && f.endsWith(".json"))
      .sort();
  return { root, store, clock, advance, change, files };
}
const entry = (at: string, i: number): AutomaticBackupEntry => ({
  createdAt: at,
  file: `auto-${at.replaceAll(":", "-")}-${i.toString(16).padStart(8, "0")}.json`,
  fingerprint: "a".repeat(64),
  checksum: "b".repeat(64),
});

test("default schedule is hourly; retain hourly for 7 days and daily for 30", () => {
  assert.deepEqual(backupPolicy, {
    intervalMs: hour,
    hourlyDays: 7,
    dailyDays: 30,
    minimumCopies: 3,
  });
  const now = new Date("2026-10-31T12:00:00.000Z");
  const entries: AutomaticBackupEntry[] = [];
  for (let d = 0; d < 40; d++)
    for (const h of [1, 2, 3, 4])
      entries.push(
        entry(
          new Date(now.getTime() - d * day - h * hour).toISOString(),
          entries.length,
        ),
      );
  const kept = retainedAutomaticBackups(entries, now);
  assert.equal(kept.size, 7 * 4 + 23);
  for (const e of entries) {
    const age = now.getTime() - Date.parse(e.createdAt);
    if (age < 7 * day) assert.ok(kept.has(e.file));
    else if (age >= 30 * day) assert.ok(!kept.has(e.file));
  }
  for (let d = 7; d < 30; d++)
    assert.equal(
      entries.filter(
        (e) =>
          e.createdAt.slice(0, 10) ===
            new Date(now.getTime() - d * day - hour)
              .toISOString()
              .slice(0, 10) && kept.has(e.file),
      ).length,
      1,
    );
});

test("real restore verification, restart deduplication and read-only audit do not duplicate a backup", async (t) => {
  const f = setup(t);
  let checks = 0;
  const verify = async (file: string) => {
    checks++;
    return verifyBackupByRestore(file);
  };
  const service = new AutomaticBackups(f.store, verify, f.clock);
  const first = await service.run();
  assert.equal(first.created, true);
  assert.equal(checks, 1);
  f.advance(hour);
  f.store.audit("get_project_info", "ok");
  assert.equal((await service.run()).created, false);
  assert.equal(
    (await new AutomaticBackups(f.store, verify, f.clock).run()).created,
    false,
  );
  assert.equal(f.files().length, 1);
  assert.equal(checks, 1);
  f.change();
  assert.equal((await service.run()).created, true);
  assert.equal(checks, 2);
  assert.equal(
    readBackup((await service.run()).file).state.revision,
    f.store.get().revision,
  );
});

test("same-hour thinning keeps three and never touches manual, legacy or unindexed files", async (t) => {
  const f = setup(t);
  const manual = f.store.backup();
  const unindexed = f.store.backup({ automatic: true, at: f.clock() });
  const original = readFileSync(manual);
  let checked = 0;
  const service = new AutomaticBackups(
    f.store,
    async () => {
      checked++;
      return true;
    },
    f.clock,
  );
  for (let i = 0; i < 4; i++) {
    f.change();
    f.advance(60000);
    await service.run();
  }
  assert.equal(checked, 4);
  assert.equal(f.files().length, 4); // Three managed + one unindexed.
  assert.ok(existsSync(manual));
  assert.deepEqual(readFileSync(manual), original);
  assert.ok(existsSync(unindexed));
  assert.equal(
    JSON.parse(readFileSync(service.catalogPath, "utf8")).entries.length,
    3,
  );
});

test("verification failure preserves every existing file; unchanged expiry rechecks restoration", async (t) => {
  const f = setup(t);
  let fail = false;
  let checks = 0;
  const service = new AutomaticBackups(
    f.store,
    async () => {
      checks++;
      if (fail) throw new Error("restore failed");
      return true;
    },
    f.clock,
  );
  for (let i = 0; i < 4; i++) {
    f.change();
    await service.run();
    f.advance(hour);
  }
  const before = f.files();
  assert.equal(before.length, 4);
  f.advance(40 * day);
  fail = true;
  await assert.rejects(service.run(), /restore failed/);
  assert.deepEqual(f.files(), before);
  assert.equal(service.error, "restore failed");
  fail = false;
  const result = await service.run();
  assert.equal(result.created, false);
  assert.equal(result.removed, 1);
  assert.equal(f.files().length, 3);
  assert.equal(service.error, null);
  assert.equal(checks, 6);
});

test("a corrupt old backup aborts ALL deletions even when a new backup passed restoration", async (t) => {
  const f = setup(t);
  const service = new AutomaticBackups(f.store, async () => true, f.clock);
  for (let i = 0; i < 4; i++) {
    f.change();
    await service.run();
    f.advance(hour);
  }
  const before = f.files();
  writeFileSync(join(f.store.backups, before[0]), "corrupt");
  f.advance(40 * day);
  f.change();
  await assert.rejects(service.run());
  for (const name of before) assert.ok(existsSync(join(f.store.backups, name)));
  assert.equal(f.files().length, 5);
});

test("new snapshot failing restoration does not start cleanup or enter the catalog", async (t) => {
  const f = setup(t);
  let fail = false;
  const service = new AutomaticBackups(
    f.store,
    async () => {
      if (fail) throw new Error("restore failed");
      return true;
    },
    f.clock,
  );
  for (let i = 0; i < 4; i++) {
    f.change();
    await service.run();
    f.advance(hour);
  }
  const before = f.files();
  const catalog = readFileSync(service.catalogPath);
  f.advance(40 * day);
  f.change();
  fail = true;
  await assert.rejects(service.run(), /restore failed/);
  for (const name of before) assert.ok(existsSync(join(f.store.backups, name)));
  assert.deepEqual(readFileSync(service.catalogPath), catalog);
});

test("invalid catalog cannot target outside files and cannot trigger deletion", async (t) => {
  const f = setup(t);
  const service = new AutomaticBackups(f.store, async () => true, f.clock);
  await service.run();
  const before = f.files();
  const catalog = JSON.parse(readFileSync(service.catalogPath, "utf8"));
  catalog.entries[0].file = "../workspace.sqlite";
  writeFileSync(service.catalogPath, JSON.stringify(catalog));
  await assert.rejects(service.run());
  assert.deepEqual(f.files(), before);
  assert.equal(f.store.verify().database[0].integrity_check, "ok");
});

test("startup/shutdown requests serialize and capture edits made while verification was running", async (t) => {
  const f = setup(t);
  let ready!: () => void;
  let unblock!: () => void;
  const began = new Promise<void>((r) => (ready = r));
  const gate = new Promise<void>((r) => (unblock = r));
  let calls = 0;
  const service = new AutomaticBackups(
    f.store,
    async () => {
      if (++calls === 1) {
        ready();
        await gate;
      }
      return true;
    },
    f.clock,
  );
  const first = service.run();
  await began;
  f.change();
  const second = service.run();
  unblock();
  const results = await Promise.all([first, second]);
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.created));
  assert.equal(
    readBackup(results[1].file).state.revision,
    f.store.get().revision,
  );
});

test("clock rollback and absent indexed files never create false deduplication or remove the last copy", async (t) => {
  const f = setup(t);
  const service = new AutomaticBackups(f.store, async () => true, f.clock);
  await service.run();
  f.advance(-2 * day);
  f.change();
  const next = await service.run();
  assert.equal(next.created, true);
  assert.equal((await service.run()).created, false);
  const retained = retainedAutomaticBackups(
    [entry("2026-12-01T00:00:00.000Z", 0)],
    f.clock(),
  );
  assert.equal(retained.size, 1);
  const catalog = JSON.parse(readFileSync(service.catalogPath, "utf8"));
  rmSync(join(f.store.backups, basename(next.file)));
  assert.equal((await service.run()).created, true);
  assert.ok(catalog.entries.length > 0);
});
