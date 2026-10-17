import { useEffect, useRef, useState } from "react";
import type { Chapter, State } from "../../server/types";
import { Select, SelectOption } from "./Select";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

type Snapshot = { state: State; chapter: Chapter };
export function ChapterStatus({
  chapter,
  prepare,
  release,
  apply,
}: {
  chapter: Chapter;
  prepare: () => Promise<Snapshot>;
  release: () => void;
  apply: (
    snapshot: Snapshot,
    status: string,
    acknowledged?: true,
  ) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [warning, setWarning] = useState("");
  const releaseRef = useRef(release);
  releaseRef.current = release;
  useEffect(() => () => releaseRef.current(), []);
  const cancel = () => {
    setPending(null);
    release();
  };
  async function choose(status: string) {
    setWarning("");
    setBusy(true);
    let keepLocked = false;
    try {
      const snapshot = await prepare();
      if (status === "Planejado" && snapshot.chapter.started) {
        setWarning(
          "Este capítulo já foi iniciado e não pode voltar a Planejado, mesmo sem texto.",
        );
        return;
      }
      if (
        status === "Concluído" &&
        snapshot.chapter.status !== status &&
        snapshot.state.comments.some(
          (c) => c.chapterId === chapter.id && c.status === "open",
        )
      ) {
        setPending(snapshot);
        keepLocked = true;
        return;
      }
      await apply(snapshot, status);
    } catch (error) {
      setWarning((error as Error).message);
    } finally {
      setBusy(false);
      if (!keepLocked) release();
    }
  }
  const count = pending?.state.comments.filter(
    (c) => c.chapterId === chapter.id && c.status === "open",
  ).length;
  return (
    <div className="chapter-status-control">
      <Popover
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) cancel();
        }}
      >
        <PopoverAnchor asChild>
          <div>
            <Select
              aria-label="Status do capítulo"
              value={chapter.status}
              disabled={busy || !!pending}
              onValueChange={(value) => void choose(value)}
            >
              {[
                "Planejado",
                "Em desenvolvimento",
                "Em revisão",
                "Concluído",
              ].map((s) => (
                <SelectOption key={s}>{s}</SelectOption>
              ))}
            </Select>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          side="top"
          className="chapter-status-confirm"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="completion-question"
          >
            <p id="completion-question">
              Este capítulo tem {count} comentários sem resolução. Deseja
              marcá-lo como concluído mesmo assim?
            </p>
            <div className="actions">
              <button disabled={busy} onClick={cancel}>
                Cancelar
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (!pending) return;
                  setBusy(true);
                  try {
                    await apply(pending, "Concluído", true);
                    setPending(null);
                  } catch (error) {
                    setWarning((error as Error).message);
                    setPending(null);
                  } finally {
                    setBusy(false);
                    release();
                  }
                }}
              >
                Concluir mesmo assim
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {warning && (
        <p role="alert" className="chapter-status-warning">
          {warning}
        </p>
      )}
    </div>
  );
}
