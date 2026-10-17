import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { OnboardingStore } from "../server/onboarding";
import { Domain } from "../server/domain";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "laurex-onboarding-"));
  const store = new Store(root);
  return {
    root,
    store,
    cleanup: () => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
test("fresh setup, independent revision, durable interruption, dismissal and replay", () => {
  const f = fixture();
  try {
    let o = new OnboardingStore(f.store);
    const revision = f.store.get().revision,
      versions = f.store.versions().length;
    const update = (event: string, extra = {}) =>
      o.update({ expectedRevision: o.get().revision, event, ...extra });
    assert.equal(o.get().setup, "pending");
    assert.equal(o.get().status, "not_started");
    update("import");
    assert.equal(o.get().setup, "import");
    update("setup");
    update("start");
    update("progress", { step: "ideas" });
    update("hint", { hint: "selection" });
    f.store.close();
    const reopened = new Store(f.root);
    o = new OnboardingStore(reopened);
    assert.equal(o.get().lastStep, "ideas");
    assert.equal(o.get().status, "in_progress");
    assert.deepEqual(o.get().hints, ["selection"]);
    update("dismiss");
    update("start");
    update("progress", { step: "navigation" });
    assert.equal(o.get().status, "dismissed");
    assert.equal(o.get().lastStep, "ideas");
    assert.equal(reopened.get().revision, revision);
    assert.equal(reopened.versions().length, versions);
    reopened.close();
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("existing project receives invitation without setup; completion resists stale tabs and version restore", () => {
  const f = fixture();
  try {
    const domain = new Domain(f.store);
    domain.call("create_chapter", {
      expectedRevision: f.store.get().revision,
      title: "Original",
    });
    const old = f.store.get().revision;
    const o = new OnboardingStore(f.store);
    assert.equal(o.get().setup, "ready");
    assert.equal(o.get().status, "not_started");
    const stale = o.get().revision;
    o.update({ expectedRevision: stale, event: "complete" });
    assert.throws(
      () =>
        o.update({
          expectedRevision: stale,
          event: "progress",
          step: "comments",
        }),
      /outra aba/,
    );
    o.update({ expectedRevision: o.get().revision, event: "start" });
    assert.equal(o.get().status, "completed");
    assert.equal(f.store.get().chapters[0].revision, 1);
    domain.call("update_settings", {
      expectedRevision: f.store.get().revision,
      name: "Novo",
    });
    domain.call("restore_version", {
      expectedRevision: f.store.get().revision,
      version: old,
    });
    assert.equal(o.get().status, "completed");
    assert.equal(f.store.get().chapters[0].title, "Original");
  } finally {
    f.cleanup();
  }
});
test("storage errors do not produce first-visit defaults; schemas reject foreign metadata writes", () => {
  const f = fixture();
  try {
    const o = new OnboardingStore(f.store);
    assert.throws(() =>
      o.update({ expectedRevision: 0, event: "progress", step: "fake" }),
    );
    f.store.db.exec("DELETE FROM local_onboarding");
    assert.throws(() => o.get(), /indisponível/);
    assert.throws(() => o.update({ expectedRevision: 0, event: "complete" }));
    assert.throws(() => new Domain(f.store).call("onboarding" as never, {}));
  } finally {
    f.cleanup();
  }
});

test("setup interrupted after chapter creation resumes the established project without duplicating setup", () => {
  const f = fixture();
  try {
    let onboarding = new OnboardingStore(f.store);
    assert.equal(onboarding.get().setup, "pending");
    new Domain(f.store).call("create_chapter", {
      expectedRevision: f.store.get().revision,
      title: "Capítulo existente",
    });
    f.store.close();
    const reopened = new Store(f.root);
    onboarding = new OnboardingStore(reopened);
    assert.equal(onboarding.get().setup, "ready");
    assert.equal(onboarding.get().status, "not_started");
    assert.equal(reopened.get().chapters.length, 1);
    reopened.close();
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});


test("MCP authorization before first launch does not skip academic setup", () => {
  const f = fixture();
  try {
    new Domain(f.store).call("update_settings", {
      expectedRevision: f.store.get().revision,
      mcpEnabled: true,
      mcpWrite: true,
    });
    assert.ok(f.store.get().revision > 1);
    const onboarding = new OnboardingStore(f.store);
    assert.equal(onboarding.get().setup, "pending");
    assert.equal(f.store.get().settings.mcpWrite, true);
  } finally { f.cleanup(); }
});
