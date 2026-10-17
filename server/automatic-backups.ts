import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { Store, atomic } from "./store";
import { readBackup, verifyBackupByRestore } from "./recovery";

export const backupPolicy = {
  intervalMs: 60 * 60 * 1000,
  hourlyDays: 7,
  dailyDays: 30,
  minimumCopies: 3,
} as const;
const day = 24 * 60 * 60 * 1000;
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
// Read-only MCP audit events do not change the academic project or its recovery history.
export function backupFingerprint(payload: ReturnType<Store["backupPayload"]>) {
  const { audit: _audit, ...academic } = payload;
  return hash(academic);
}
const entrySchema = z
  .object({
    file: z
      .string()
      .regex(
        /^auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-[a-f0-9]{8}\.json$/,
      ),
    createdAt: z.iso.datetime(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AutomaticBackupEntry = z.infer<typeof entrySchema>;
const catalogSchema = z
  .object({
    format: z.literal("laura-automatic-backups-v1"),
    projectId: z.uuid(),
    entries: z.array(entrySchema),
  })
  .strict();

export function retainedAutomaticBackups(
  entries: AutomaticBackupEntry[],
  now: Date,
) {
  const sorted = [...entries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const keep = new Set(
    sorted.slice(0, backupPolicy.minimumCopies).map((e) => e.file),
  );
  const buckets = new Set<string>();
  for (const entry of sorted) {
    const age = now.getTime() - Date.parse(entry.createdAt);
    if (age < 0) {
      keep.add(entry.file);
      continue;
    } // Clock rollback must not discard future-dated copies.
    if (age >= backupPolicy.dailyDays * day) continue;
    const bucket =
      age < backupPolicy.hourlyDays * day
        ? "hour:" + entry.createdAt.slice(0, 13)
        : "day:" + entry.createdAt.slice(0, 10);
    if (!buckets.has(bucket)) {
      buckets.add(bucket);
      keep.add(entry.file);
    }
  }
  return keep;
}

export class AutomaticBackups {
  private queue: Promise<unknown> = Promise.resolve();
  readonly catalogPath: string;
  error: string | null = null;
  constructor(
    private store: Store,
    private verify = verifyBackupByRestore,
    private clock = () => new Date(),
  ) {
    this.catalogPath = join(store.backups, "automatic-index.json");
  }
  run() {
    // Startup, timer and shutdown share one queue; a later request always reads a fresh snapshot.
    const work = this.queue
      .catch(() => {})
      .then(() => this.perform())
      .then(
        (result) => {
          this.error = null;
          return result;
        },
        (error) => {
          this.error = (error as Error).message;
          throw error;
        },
      );
    this.queue = work;
    return work;
  }
  private readCatalog() {
    if (!existsSync(this.catalogPath)) return [];
    if (!lstatSync(this.catalogPath).isFile())
      throw new Error(
        "Índice de backups automáticos inválido; nenhuma cópia foi apagada.",
      );
    const catalog = catalogSchema.parse(
      JSON.parse(readFileSync(this.catalogPath, "utf8")),
    );
    if (
      catalog.projectId !== this.store.get().id ||
      new Set(catalog.entries.map((e) => e.file)).size !==
        catalog.entries.length
    )
      throw new Error(
        "Índice de backups não corresponde ao projeto; nenhuma cópia foi apagada.",
      );
    for (const entry of catalog.entries)
      if (
        !entry.file.startsWith(
          "auto-" + entry.createdAt.replaceAll(":", "-") + "-",
        )
      )
        throw new Error(
          "Data do backup automático inválida; nenhuma cópia foi apagada.",
        );
    // A crash after an unlink may leave a stale record. Missing files cannot count as recovery copies.
    return catalog.entries.filter((e) =>
      existsSync(join(this.store.backups, e.file)),
    );
  }
  private writeCatalog(entries: AutomaticBackupEntry[]) {
    atomic(
      this.catalogPath,
      JSON.stringify({
        format: "laura-automatic-backups-v1",
        projectId: this.store.get().id,
        entries,
      }),
    );
  }
  private validateEntry(entry: AutomaticBackupEntry) {
    const path = join(this.store.backups, entry.file);
    if (!lstatSync(path).isFile())
      throw new Error(
        "Arquivo de backup inesperado; nenhuma cópia foi apagada.",
      );
    const payload = readBackup(path);
    if (
      payload.state.id !== this.store.get().id ||
      hash(payload) !== entry.checksum ||
      backupFingerprint(payload) !== entry.fingerprint
    )
      throw new Error(
        "Backup automático alterado ou inválido; nenhuma cópia foi apagada.",
      );
    return path;
  }
  private async perform() {
    const now = this.clock();
    const entries = this.readCatalog();
    const fingerprint = backupFingerprint(this.store.backupPayload());
    const latest = entries.at(-1);
    let created = false;
    let verified: string | undefined;
    let file: string;
    if (latest?.fingerprint === fingerprint) {
      // Deduplication must never trust a stale catalog or an unreadable backup.
      file = this.validateEntry(latest);
    } else {
      file = this.store.backup({ automatic: true, at: now });
      await this.verify(file);
      verified = file;
      const payload = readBackup(file);
      entries.push({
        file: basename(file),
        createdAt: now.toISOString(),
        fingerprint: backupFingerprint(payload),
        checksum: hash(payload),
      });
      this.writeCatalog(entries);
      created = true;
    }
    const keep = retainedAutomaticBackups(entries, now);
    const expired = entries.filter((e) => !keep.has(e.file));
    if (expired.length) {
      // Validate ALL indexed copies and restore the latest survivor BEFORE the first deletion.
      for (const entry of entries) this.validateEntry(entry);
      if (verified !== file) await this.verify(file);
      for (const entry of expired)
        unlinkSync(join(this.store.backups, entry.file));
      this.writeCatalog(entries.filter((e) => keep.has(e.file)));
    }
    return { file, created, removed: expired.length, policy: backupPolicy };
  }
}
