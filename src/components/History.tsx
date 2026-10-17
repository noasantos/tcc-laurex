import { Select, SelectOption } from "./Select";
import { useEffect, useState } from "react";
import { History, ShieldCheck } from "lucide-react";
import { request } from "../api";
import type { State } from "../../server/types";
import type { Mutate } from "./Review";
import { Diff, SidePanel, Field, date } from "./Primitives";
export function VersionHistory({
  state,
  mutate,
}: {
  state: State;
  mutate: Mutate;
}) {
  const [versions, setVersions] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [snapshot, setSnapshot] = useState<State | null>(null),
    [chapterId, setChapterId] = useState(state.chapters[0]?.id || ""),
    [restore, setRestore] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    request("versions")
      .then(setVersions)
      .catch((e) => setError(e.message));
  }, [state.revision]);
  const old = snapshot?.chapters.find((c) => c.id === chapterId),
    current = state.chapters.find((c) => c.id === chapterId);
  return (
    <section className="collection">
      <div className="page-heading">
        <div>
          <h1>Histórico</h1>
          <p>
            Volte a qualquer momento. Restaurar sempre cria uma nova versão.
          </p>
        </div>
        <History size={24} />
      </div>
      {error && (
        <p role="alert" className="notice error-text">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          onClick={async () => {
            try {
              const r = await request("backup", {});
              setError("Backup criado: " + r.file);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <ShieldCheck size={16} /> Criar ponto de recuperação
        </button>
      </div>
      <div className="history-list">
        {versions.map((v) => (
          <button
            className="history-row"
            key={v.id}
            onClick={async () => {
              try {
                const snap = await request("action/get_version", {
                  version: v.id,
                });
                setSelected({ ...v, expectedRevision: state.revision });
                setSnapshot(snap);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <span className="version-dot" />
            <div>
              <strong>Versão {v.id}</strong>
              <p>
                {v.action.replaceAll("_", " ")} ·{" "}
                {v.origin === "mcp"
                  ? "ChatGPT"
                  : v.origin === "system"
                    ? "Sistema"
                    : "Laura"}
              </p>
            </div>
            <time>{date(v.createdAt)}</time>
          </button>
        ))}
      </div>
      {selected && snapshot && (
        <SidePanel
          title={`Versão ${selected.id} · ${date(selected.createdAt)}`}
          wide
          onClose={() => {
            setSelected(null);
            setRestore(false);
          }}
        >
          <Field label="Comparar capítulo com a versão atual">
            <Select
              value={chapterId}
              onValueChange={(value) => setChapterId(value)}
            >
              {state.chapters.map((c) => (
                <SelectOption key={c.id} value={c.id}>
                  {c.title}
                </SelectOption>
              ))}
            </Select>
          </Field>
          {old && current ? (
            <Diff before={old.content} after={current.content} />
          ) : (
            <p className="notice">
              Este capítulo não existia numa das versões.
            </p>
          )}
          <p className="subtle">
            {snapshot.chapters.length} capítulos · {snapshot.comments.length}{" "}
            comentários · {snapshot.notes.length} notas
          </p>
          {restore ? (
            <div className="notice">
              <p>
                Todo o projeto voltará ao estado da versão {selected.id}. O
                estado atual será preservado num backup e no histórico.
              </p>
              <button
                className="primary"
                onClick={async () => {
                  await mutate("restore_version", {
                    expectedRevision: selected.expectedRevision,
                    version: selected.id,
                  });
                  setSelected(null);
                  setRestore(false);
                }}
              >
                Restaurar esta versão
              </button>
            </div>
          ) : (
            <button onClick={() => setRestore(true)}>Rever restauração</button>
          )}
        </SidePanel>
      )}
    </section>
  );
}
