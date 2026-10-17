import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { State } from "../../server/types";
import type { Mutate } from "./Review";
import { maximumChapterNumber } from "../../server/chapter-numbering";
import { ChapterPlacement } from "./ChapterPlacement";
import "./chapter-create.css";

export function ChapterCreate({
  state,
  mutate,
  onCreated,
  onCancel,
}: {
  state: State;
  mutate: Mutate;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [plan, setPlan] = useState("");
  const [number, setNumber] = useState(
    String(Math.max(0, ...state.chapters.map((c, i) => c.number ?? i + 1)) + 1),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const validNumber =
    Number.isInteger(Number(number)) &&
    Number(number) >= 1 &&
    Number(number) <= maximumChapterNumber;
  return (
    <section className="page-scroll chapter-create-page">
      <div className="chapter-create-content">
        <button className="text-button chapter-create-back" onClick={onCancel}>
          <ArrowLeft size={14} /> Voltar ao trabalho
        </button>
        <div className="chapter-create-layout">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving || !title.trim() || !validNumber) return;
              setSaving(true);
              setError("");
              try {
                const result = await mutate("create_chapter", {
                  title: title.trim(),
                  plan,
                  parentId: null,
                  number: Number(number),
                });
                onCreated(result.result.id);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <p className="chapter-create-eyebrow">ESTRUTURA DO TRABALHO</p>
            <input
              name="title"
              className="chapter-create-title"
              aria-label="Título do novo capítulo"
              placeholder="Novo capítulo"
              maxLength={200}
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="chapter-create-intro">
              Escolha o número na prévia. Ele é separado do título. O
              texto pode ser desenvolvido depois, com o ChatGPT.
            </p>

            <label className="chapter-create-label">
              O que este capítulo deve abordar <span>Opcional</span>
              <textarea
                name="plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                rows={5}
                placeholder="Objetivo, perguntas e ideias para orientar a escrita…"
              />
            </label>
            <p className="chapter-create-hint">
              Essas ideias ficam no planejamento e não entram no texto
              acadêmico.
            </p>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                type="submit"
                className="primary"
                disabled={saving || !title.trim() || !validNumber}
              >
                {saving ? "Criando…" : "Criar capítulo"}
                <ArrowRight size={14} />
              </button>
              <button type="button" className="text-button" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </form>
          <ChapterPlacement
            chapters={state.chapters}
            title={title}
            number={number}
            onNumberChange={setNumber}
            disabled={saving}
          />
        </div>
      </div>
    </section>
  );
}
