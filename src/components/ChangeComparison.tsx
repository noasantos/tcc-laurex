import { useMemo, useState } from "react";
import { diffWords } from "diff";
import type { Proposal } from "../../server/types";
import { comparisonRows, comparisonSource } from "./change-comparison";
import "./comparison.css";

function Words({
  before,
  after,
  side,
}: {
  before: string;
  after: string;
  side: "before" | "after";
}) {
  return diffWords(before, after).map((part, i) =>
    part.added ? (
      side === "after" ? (
        <ins key={i}>{part.value}</ins>
      ) : null
    ) : part.removed ? (
      side === "before" ? (
        <del key={i}>{part.value}</del>
      ) : null
    ) : (
      <span key={i}>{part.value}</span>
    ),
  );
}
export function ChangeComparison({
  proposal: p,
  compact = false,
}: {
  proposal: Proposal;
  compact?: boolean;
}) {
  const projection = useMemo(() => comparisonSource(p), [p]);
  const [source, setSource] = useState(false),
    [layout, setLayout] = useState("split"),
    [all, setAll] = useState(false);
  const native = source || projection.sourceRequired;
  const before = native
    ? (p.beforeLatex ?? projection.before)
    : projection.before;
  const after = native ? (p.afterLatex ?? projection.after) : projection.after;
  const rows = useMemo(
    () =>
      comparisonRows(
        before,
        after,
        all ? Number.MAX_SAFE_INTEGER : compact ? 1 : 2,
      ),
    [before, after, all, compact],
  );
  return (
    <div
      className={
        "change-comparison " +
        (native ? "is-source " : "") +
        (layout === "unified" ? "is-unified" : "")
      }
    >
      <div className="comparison-controls">
        <span>{native ? "Fonte LaTeX" : "Texto"} · somente leitura</span>
        <div>
          {p.afterLatex !== undefined && !projection.sourceRequired && (
            <button
              className="text-button"
              aria-pressed={source}
              onClick={() => setSource(!source)}
            >
              {source ? "Ver texto" : "Ver LaTeX"}
            </button>
          )}
          {!compact && (
            <button
              className="text-button"
              onClick={() =>
                setLayout(layout === "split" ? "unified" : "split")
              }
            >
              {layout === "split" ? "Ver unificado" : "Lado a lado"}
            </button>
          )}
        </div>
      </div>
      {projection.sourceRequired && (
        <p className="comparison-note">
          A alteração envolve formatação ou elementos do documento. Compare a
          fonte preservada abaixo.
        </p>
      )}
      {rows.length ? (
        <>
          <div className="comparison-labels">
            <span>
              Antes <small>− removido</small>
            </span>
            <span>
              Depois <small>+ adicionado</small>
            </span>
          </div>
          <div className="comparison-lines">
            {rows.map((r, i) =>
              r.omitted ? (
                <button
                  key={i}
                  className="comparison-omission"
                  onClick={() => setAll(true)}
                >
                  Mostrar {r.omitted}{" "}
                  {r.omitted === 1
                    ? "linha sem alteração"
                    : "linhas sem alterações"}
                </button>
              ) : (
                <div
                  key={i}
                  className={
                    "comparison-line " + (r.changed ? "changed" : "unchanged")
                  }
                >
                  <div
                    className={
                      r.changed && r.before !== undefined ? "removed" : ""
                    }
                  >
                    <span className="diff-number" aria-hidden>
                      {r.oldLine}
                    </span>
                    <span className="diff-sign" aria-hidden>
                      {r.changed && r.before !== undefined ? "−" : ""}
                    </span>
                    <span className="diff-content">
                      {r.before !== undefined && (
                        <Words
                          before={r.before}
                          after={r.after ?? ""}
                          side="before"
                        />
                      )}
                    </span>
                  </div>
                  <div
                    className={
                      r.changed && r.after !== undefined ? "added" : ""
                    }
                  >
                    <span className="diff-number" aria-hidden>
                      {r.newLine}
                    </span>
                    <span className="diff-sign" aria-hidden>
                      {r.changed && r.after !== undefined ? "+" : ""}
                    </span>
                    <span className="diff-content">
                      {r.after !== undefined && (
                        <Words
                          before={r.before ?? ""}
                          after={r.after}
                          side="after"
                        />
                      )}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      ) : (
        <p className="comparison-note">
          Nenhuma diferença nesta visualização.
          {!native && p.afterLatex !== undefined
            ? " Consulte também a fonte LaTeX."
            : ""}
        </p>
      )}
    </div>
  );
}
