import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import type { State } from "../../server/types";
import type { Mutate } from "./Review";
import { Select, SelectOption } from "./Select";
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
  const [position, setPosition] = useState(String(state.chapters.length));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const index = Math.min(Number(position), state.chapters.length);
  const ordered: { id: string; title: string }[] = [...state.chapters];
  ordered.splice(index, 0, {
    id: "new",
    title: title.trim() || "Novo capítulo",
  });
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
              if (saving || !title.trim()) return;
              setSaving(true);
              setError("");
              try {
                const result = await mutate("create_chapter", {
                  title: title.trim(),
                  plan,
                  parentId: null,
                  position: index,
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
              Defina o lugar deste capítulo no trabalho. O texto pode ser
              desenvolvido depois, com o ChatGPT.
            </p>
            <label className="chapter-create-label">
              Posição no documento
              <Select
                value={String(index)}
                onValueChange={setPosition}
                aria-label="Posição do novo capítulo"
              >
                {state.chapters.map((chapter, i) => (
                  <SelectOption key={chapter.id} value={String(i)}>
                    {i + 1}. Antes de {chapter.title}
                  </SelectOption>
                ))}
                <SelectOption value={String(state.chapters.length)}>
                  {state.chapters.length + 1}.{" "}
                  {state.chapters.length
                    ? "Ao final do trabalho"
                    : "Primeiro capítulo"}
                </SelectOption>
              </Select>
            </label>
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
                disabled={saving || !title.trim()}
              >
                {saving ? "Criando…" : "Criar capítulo"}
                <ArrowRight size={14} />
              </button>
              <button type="button" className="text-button" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </form>
          <aside
            className="chapter-order-preview"
            aria-label="Prévia da ordem dos capítulos"
          >
            <h2>
              <FileText size={14} /> Ordem dos capítulos
            </h2>
            <ol>
              {ordered.map((chapter, i) => (
                <li
                  key={chapter.id}
                  className={chapter.id === "new" ? "is-new" : ""}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>{chapter.title}</span>
                  {chapter.id === "new" && <small>Novo</small>}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </section>
  );
}
