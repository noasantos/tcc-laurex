import { test } from "node:test";
import assert from "node:assert/strict";
import { latexPreview } from "../server/latex-preview";
import { mapScroll } from "../src/components/scrollMapping";
import type { Doc } from "../server/types";

test("preview LaTeX preserva originais, citações e notas sem alterar o documento", () => {
  const raw = "\\newcommand{\\hipotese}[1]{#1}\n% original\n\\hipotese{A}";
  const doc: Doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { id: "p1" },
        content: [
          {
            type: "text",
            text: "Análise & revisão",
            marks: [{ type: "bold" }],
          },
          { type: "citation", attrs: { key: "silva2023" } },
          { type: "footnote", attrs: { text: "Nota de pesquisa" } },
        ],
      },
      { type: "rawLatex", attrs: { source: raw } },
    ],
  };
  const before = JSON.stringify(doc);
  const blocks = latexPreview(doc);
  assert.match(blocks[0].code, /\\textbf\{Análise \\& revisão\}/);
  assert.ok(blocks[0].code.includes("\\cite{silva2023}"));
  assert.ok(blocks[0].code.includes("\\footnote{Nota de pesquisa}"));
  assert.equal(blocks[1].code, raw);
  assert.equal(JSON.stringify(doc), before);
});

test("preview informa conversão indisponível sem ocultar blocos seguintes", () => {
  const blocks = latexPreview({
    type: "doc",
    content: [
      { type: "table", content: [] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Texto preservado" }],
      },
    ],
  });
  assert.ok(blocks[0].error);
  assert.equal(blocks[0].code, "");
  assert.equal(blocks[1].code, "Texto preservado\n\n");
});

test("scroll acompanha blocos com alturas diferentes nos dois sentidos e alcança os extremos", () => {
  assert.equal(mapScroll(200, 1000, 2000, [0, 200, 600], [0, 800, 1200]), 800);
  assert.equal(mapScroll(400, 1000, 2000, [0, 200, 600], [0, 800, 1200]), 1000);
  assert.equal(mapScroll(1000, 2000, 1000, [0, 800, 1200], [0, 200, 600]), 400);
  assert.equal(mapScroll(0, 1000, 2000, [], []), 0);
  assert.equal(mapScroll(1000, 1000, 2000, [0, 200], [0, 800]), 2000);
  assert.equal(mapScroll(100, 1000, 0, [0], [0]), 0);
  assert.equal(mapScroll(50, 100, 200, [0, 0, 100], [0, 5, 200]), 100);
});
