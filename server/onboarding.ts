import { z } from "zod";
import type { Store } from "./store";
import { stepIds, hintIds, type Onboarding } from "./onboarding-types";
export type { Onboarding } from "./onboarding-types";
const updateSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    event: z.enum([
      "setup",
      "import",
      "start",
      "progress",
      "complete",
      "dismiss",
      "hint",
    ]),
    step: z.enum(stepIds).optional(),
    hint: z.enum(hintIds).optional(),
  })
  .strict();
export class OnboardingStore {
  constructor(private store: Store) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS local_onboarding(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)",
    );
    const s = store.get();
    const initial: Onboarding = {
      version: 1,
      revision: 0,
      // MCP authorization alone changes the project revision, but is not academic setup.
      // History also recognizes established projects whose chapters were later removed.
      setup: this.hasAcademicWork() ? "ready" : "pending",
      status: "not_started",
      lastStep: "navigation",
      hints: [],
    };
    store.db
      .prepare("INSERT OR IGNORE INTO local_onboarding VALUES(1,?)")
      .run(JSON.stringify(initial));
    // A setup interrupted after creating chapters must never offer to recreate them.
    const existing = this.get();
    if (existing.setup === "pending" && s.chapters.length > 0) {
      try {
        this.update({ expectedRevision: existing.revision, event: "setup" });
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 409) throw error;
      }
    }
  }
  private hasAcademicWork() {
    return Boolean(this.store.db.prepare(`SELECT 1 FROM versions
      WHERE json_extract(json, '$.name') != 'TCC Laurex'
         OR json_array_length(json, '$.chapters') > 0
         OR json_array_length(json, '$.notes') > 0
         OR json_array_length(json, '$.comments') > 0
         OR json_array_length(json, '$.references') > 0
         OR json_array_length(json, '$.proposals') > 0
      LIMIT 1`).get());
  }
  get(): Onboarding {
    const row = this.store.db
      .prepare("SELECT json FROM local_onboarding WHERE id=1")
      .get() as { json: string } | undefined;
    if (!row)
      throw new Error(
        "Apresentação indisponível. Reabra o espaço para tentar novamente.",
      );
    const value = JSON.parse(row.json);
    if (value.version !== 1)
      throw new Error("Versão da apresentação incompatível.");
    return value;
  }
  update(input: unknown) {
    const a = updateSchema.parse(input);
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.get();
      if (s.revision !== a.expectedRevision)
        throw Object.assign(
          new Error(
            "A apresentação mudou em outra aba. Reabra para continuar.",
          ),
          { statusCode: 409 },
        );
      const terminal = s.status === "completed" || s.status === "dismissed";
      if (a.event === "setup") s.setup = "ready";
      if (a.event === "import") s.setup = "import";
      // Replays keep terminal recognition; closing a replay must never invite again.
      if (!terminal) {
        if (a.event === "start" || a.event === "progress")
          s.status = "in_progress";
        if (a.event === "complete") s.status = "completed";
        if (a.event === "dismiss") s.status = "dismissed";
        if (a.step) s.lastStep = a.step;
      }
      if (a.event === "hint" && a.hint && !s.hints.includes(a.hint))
        s.hints.push(a.hint);
      s.revision++;
      this.store.db
        .prepare("UPDATE local_onboarding SET json=? WHERE id=1")
        .run(JSON.stringify(s));
      this.store.db.exec("COMMIT");
      return s;
    } catch (e) {
      this.store.db.exec("ROLLBACK");
      throw e;
    }
  }
}
