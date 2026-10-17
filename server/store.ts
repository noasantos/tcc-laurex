import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
  readFileSync,
  existsSync,
  readdirSync,
  appendFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { State } from "./types";
import { dirname } from "node:path";
import { exportLatex } from "./documents";
import { synchronizeChapterNumbers } from "./chapter-numbering";
import { synchronizeChapterStatus } from "./chapter-status";
import { synchronizeSources } from "./chapter-source";
export const defaultDataDirectory = () =>
  resolve(
    join(
      process.platform === "win32"
        ? process.env.LOCALAPPDATA || homedir()
        : process.platform === "darwin"
          ? join(homedir(), "Library", "Application Support")
          : join(homedir(), ".local", "share"),
      "LauraWorkspace",
    ),
  );
export const dataDirectory = () => {
  if (process.env.LAURA_DATA_DIR) return resolve(process.env.LAURA_DATA_DIR);
  const config = join(defaultDataDirectory(), "config.json");
  if (existsSync(config)) {
    const value = JSON.parse(readFileSync(config, "utf8"));
    if (typeof value.dataDirectory === "string")
      return resolve(value.dataDirectory);
  }
  return defaultDataDirectory();
};
export function atomic(path: string, data: string | Buffer) {
  const tmp = path + "." + randomUUID() + ".tmp";
  const fd = openSync(tmp, "wx", 0o600);
  try {
    const bytes = Buffer.from(data);
    let offset = 0;
    while (offset < bytes.length)
      offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
}
export class Store {
  db: DatabaseSync;
  root: string;
  backups: string;
  constructor(root = dataDirectory()) {
    this.root = root;
    this.backups = join(root, "backups");
    for (const d of [
      root,
      this.backups,
      join(root, "academic"),
      join(root, "logs"),
    ])
      mkdirSync(d, { recursive: true });
    this.db = new DatabaseSync(join(root, "workspace.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS versions(id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE, origin TEXT NOT NULL, action TEXT NOT NULL, json TEXT NOT NULL, checksum TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, name TEXT NOT NULL, content BLOB NOT NULL, checksum TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS chapter_links(id TEXT PRIMARY KEY,parent_id TEXT REFERENCES chapter_links(id) DEFERRABLE INITIALLY DEFERRED);
 CREATE TABLE IF NOT EXISTS comment_links(id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL REFERENCES chapter_links(id));
 CREATE TABLE IF NOT EXISTS note_links(id TEXT PRIMARY KEY,chapter_id TEXT REFERENCES chapter_links(id));
 CREATE TABLE IF NOT EXISTS proposal_links(id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL REFERENCES chapter_links(id),comment_id TEXT REFERENCES comment_links(id));
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at TEXT NOT NULL, tool TEXT NOT NULL, outcome TEXT NOT NULL, revision INTEGER NOT NULL);`);
    if (!this.db.prepare("SELECT 1 FROM workspace").get()) {
      const s: State = {
        id: randomUUID(),
        name: "TCC Laurex",
        revision: 0,
        chapters: [],
        comments: [],
        notes: [],
        references: [],
        proposals: [],
        settings: { mcpEnabled: false, mcpWrite: false },
      };
      this.db
        .prepare("INSERT INTO workspace VALUES(1,?)")
        .run(JSON.stringify(s));
    }
    if (this.get().revision === 0)
      this.commit(0, "initialise", "system", () => {});
    const legacy = this.get();
    if (legacy.chapters.some((c) => c.latex === undefined && !c.latexIssue)) {
      this.backup();
      this.commit(
        legacy.revision,
        "preserve_native_latex_sources",
        "system",
        () => {},
      );
    }
    const statuses = this.get();
    if (statuses.chapters.some(c => c.started === undefined || (c.status === "Planejado" && c.started))) {
      this.backup();
      this.commit(statuses.revision, "normalize_chapter_status", "system", s => {
        for (const c of s.chapters) c.revision++;
      });
    }
    const numbering = this.get();
    if (numbering.chapters.some(c => c.number === undefined)) {
      this.backup();
      this.commit(numbering.revision, "separate_chapter_numbers", "system", () => {});
    }
    this.materialize(this.get());
  }
  get(): State {
    return JSON.parse(
      (this.db.prepare("SELECT json FROM workspace WHERE id=1").get() as any)
        .json,
    );
  }
  commit(
    expected: number,
    action: string,
    origin: string,
    mutate: (s: State, op: string) => void,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.get();
      if (s.revision !== expected)
        throw Object.assign(
          new Error(
            "O projeto mudou. Atualize antes de salvar; sua edição foi preservada no navegador.",
          ),
          { statusCode: 409 },
        );
      const op = randomUUID();
      const before = structuredClone(s);
      mutate(s, op);
      synchronizeChapterNumbers(s, before);
      synchronizeSources(s, before);
      synchronizeChapterStatus(s, before);
      s.revision++;
      this.db.exec(
        "DELETE FROM proposal_links; DELETE FROM note_links; DELETE FROM comment_links; DELETE FROM chapter_links;",
      );
      for (const c of s.chapters)
        this.db
          .prepare("INSERT INTO chapter_links VALUES(?,?)")
          .run(c.id, c.parentId);
      for (const c of s.comments)
        this.db
          .prepare("INSERT INTO comment_links VALUES(?,?)")
          .run(c.id, c.chapterId);
      for (const n of s.notes)
        this.db
          .prepare("INSERT INTO note_links VALUES(?,?)")
          .run(n.id, n.chapterId);
      for (const p of s.proposals)
        this.db
          .prepare("INSERT INTO proposal_links VALUES(?,?,?)")
          .run(p.id, p.chapterId, p.commentId || null);
      const json = JSON.stringify(s);
      this.db
        .prepare("INSERT INTO versions VALUES(?,?,?,?,?,?,?)")
        .run(
          s.revision,
          new Date().toISOString(),
          op,
          origin,
          action,
          json,
          createHash("sha256").update(json).digest("hex"),
        );
      this.db.prepare("UPDATE workspace SET json=? WHERE id=1").run(json);
      this.db.exec("COMMIT");
      this.materialize(s);
      return s;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  materialize(s: State) {
    try {
      atomic(join(this.root, "academic", "workspace.json"), JSON.stringify(s));
      const sources = join(this.root, "academic", "chapters");
      mkdirSync(sources, { recursive: true });
      for (const chapter of s.chapters) {
        atomic(
          join(this.root, "academic", encodeURIComponent(chapter.id) + ".json"),
          JSON.stringify(chapter),
        );
        if (chapter.latex !== undefined) {
          atomic(
            join(sources, encodeURIComponent(chapter.id) + ".tex"),
            chapter.latex,
          );
          const assets: Record<string, Uint8Array> = {};
          try {
            exportLatex(
              chapter.content,
              assets,
              `figures/${encodeURIComponent(chapter.id)}/`,
            );
          } catch {
            /* unsupported original stays in its protected archive */
          }
          for (const [name, bytes] of Object.entries(assets)) {
            const destination = join(sources, name);
            mkdirSync(dirname(destination), { recursive: true });
            atomic(destination, Buffer.from(bytes));
          }
        }
      }
    } catch (error) {
      console.error(
        "Cópia de leitura precisa ser regenerada; o banco foi salvo:",
        (error as Error).message,
      );
    }
  }
  versions() {
    return this.db
      .prepare(
        "SELECT id,created_at as createdAt,operation_id as operationId,origin,action FROM versions ORDER BY id DESC",
      )
      .all();
  }
  version(id: number): State {
    const r = this.db
      .prepare("SELECT json, checksum FROM versions WHERE id=?")
      .get(id) as any;
    if (!r) throw new Error("Versão inexistente");
    if (createHash("sha256").update(r.json).digest("hex") !== r.checksum)
      throw new Error("Integridade da versão inválida");
    return JSON.parse(r.json);
  }
  audit(tool: string, outcome: string) {
    this.db
      .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
      .run(
        randomUUID(),
        new Date().toISOString(),
        tool,
        outcome,
        this.get().revision,
      );
    try {
      appendFileSync(
        join(this.root, "logs", "mcp.jsonl"),
        JSON.stringify({
          at: new Date().toISOString(),
          tool,
          outcome,
          revision: this.get().revision,
        }) + "\n",
      );
    } catch {}
  }
  backupPayload() {
    return {
      format: "laura-backup-v1",
      state: this.get(),
      audit: this.db.prepare("SELECT * FROM audit").all(),
      versions: this.db.prepare("SELECT * FROM versions ORDER BY id ASC").all(),
      sources: (this.db.prepare("SELECT * FROM sources").all() as any[]).map(
        (x) => ({ ...x, content: Buffer.from(x.content).toString("base64") }),
      ),
    };
  }
  backup(options: { automatic?: boolean; at?: Date } = {}) {
    const payload = this.backupPayload();
    const json = JSON.stringify(payload);
    const file = join(
      this.backups,
      `${options.automatic ? "auto-" : ""}${(options.at || new Date()).toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}.json`,
    );
    atomic(
      file,
      JSON.stringify({
        sha256: createHash("sha256").update(json).digest("hex"),
        payload,
      }),
    );
    return file;
  }
  verify() {
    return {
      database: this.db.prepare("PRAGMA integrity_check").all(),
      versions: this.versions().length,
      foreignKeys: this.db.prepare("PRAGMA foreign_key_check").all(),
      backups: readdirSync(this.backups).filter((x) => x.endsWith(".json") && x !== "automatic-index.json"),
      root: this.root,
    };
  }
  close() {
    this.db.close();
  }
}
