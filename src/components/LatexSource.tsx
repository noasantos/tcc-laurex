import { useEffect, useRef, useState } from "react";
import { Link2, Unlink2, X } from "lucide-react";
import type { Doc } from "../../server/types";
import { request } from "../api";
import { mapScroll } from "./scrollMapping";
import "./latex-source.css";

type Block = { index: number; code: string; error: string | null };

export function LatexSource({
  content,
  visual,
  onClose,
}: {
  content: Doc;
  visual: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(true);
  const source = useRef<HTMLDivElement>(null);
  const serialized = JSON.stringify(content);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      request<{ blocks: Block[] }>("latex-preview", {
        content: JSON.parse(serialized),
      })
        .then((result) => {
          if (active) {
            setBlocks(result.blocks);
            setError("");
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [serialized]);

  useEffect(() => {
    const left = visual.current,
      right = source.current;
    if (!left || !right || !synced || loading || error) return;
    let expected: { pane: HTMLElement; top: number } | null = null;
    let frame = 0;
    function sync(from: HTMLElement, to: HTMLElement, reverse: boolean) {
      if (
        expected?.pane === from &&
        Math.abs(expected.top - from.scrollTop) < 1
      ) {
        expected = null;
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visualBlocks = Array.from(
          left!.querySelectorAll<HTMLElement>(".tiptap > *"),
        );
        const codeBlocks = Array.from(
          right!.querySelectorAll<HTMLElement>("[data-source-block]"),
        );
        const positions = (pane: HTMLElement, nodes: HTMLElement[]) =>
          nodes.map(
            (node) =>
              node.getBoundingClientRect().top -
              pane.getBoundingClientRect().top +
              pane.scrollTop,
          );
        const a = positions(left!, visualBlocks),
          b = positions(right!, codeBlocks);
        const next = mapScroll(
          from.scrollTop,
          from.scrollHeight - from.clientHeight,
          to.scrollHeight - to.clientHeight,
          reverse ? b : a,
          reverse ? a : b,
        );
        to.scrollTop = next;
        expected = { pane: to, top: to.scrollTop };
      });
    }
    const onLeft = () => sync(left, right, false);
    const onRight = () => sync(right, left, true);
    left.addEventListener("scroll", onLeft, { passive: true });
    right.addEventListener("scroll", onRight, { passive: true });
    onLeft();
    return () => {
      cancelAnimationFrame(frame);
      left.removeEventListener("scroll", onLeft);
      right.removeEventListener("scroll", onRight);
    };
  }, [synced, blocks, loading, error, visual]);

  return (
    <aside className="latex-source" aria-label="Código LaTeX">
      <div className="latex-source-heading">
        <span>
          LaTeX <small>Somente leitura</small>
        </span>
        <div>
          <button
            type="button"
            aria-label={
              synced
                ? "Desativar rolagem sincronizada"
                : "Ativar rolagem sincronizada"
            }
            aria-pressed={synced}
            title={synced ? "Rolagem sincronizada" : "Rolagem independente"}
            onClick={() => setSynced((v) => !v)}
          >
            {synced ? <Link2 size={14} /> : <Unlink2 size={14} />}
          </button>
          <button
            type="button"
            aria-label="Fechar código LaTeX"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div
        className="latex-source-scroll"
        ref={source}
        tabIndex={0}
        aria-label="Fonte LaTeX do capítulo"
        aria-busy={loading}
      >
        <p className="latex-source-note">
          Código do conteúdo atual. Blocos originais preservados são exibidos
          sem conversão.
        </p>
        {loading && (
          <p className="latex-source-message" role="status">
            Preparando código…
          </p>
        )}
        {error && (
          <p className="latex-source-message" role="alert">
            Não foi possível atualizar o código. {error}
          </p>
        )}
        {!loading &&
          !error &&
          blocks.map((block) => (
            <div
              className="latex-source-block"
              data-source-block={block.index}
              key={block.index}
            >
              {block.error ? (
                <p className="latex-source-message">
                  Bloco {block.index + 1}: {block.error}
                </p>
              ) : (
                <pre>
                  <code>{block.code || "% Bloco vazio\n"}</code>
                </pre>
              )}
            </div>
          ))}
        {!loading && !error && !blocks.length && (
          <p className="latex-source-message">
            O código aparecerá quando este capítulo tiver conteúdo.
          </p>
        )}
      </div>
    </aside>
  );
}
