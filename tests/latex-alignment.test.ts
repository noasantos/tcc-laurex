import { test } from "node:test";
import assert from "node:assert/strict";
import { latexAlignment } from "../server/latex-alignment";
import { projectLatex } from "../server/chapter-source";
import { paragraph, type Doc } from "../server/types";
import { exportLatex } from "../server/documents";

test("alinhamento usa offsets literais por caractere e separa parágrafos repetidos sem estimar scroll", () => {
  const content: Doc = {
    type: "doc",
    content: [
      paragraph("Texto idêntico com acentuação e 😀."),
      paragraph("Texto idêntico com acentuação e 😀."),
    ],
  };
  const source = exportLatex(content);
  const result = latexAlignment(content, source);
  assert.equal(result.error, undefined);
  assert.equal(result.blocks.length, 2);
  for (const block of result.blocks)
    assert.equal(
      block.offsets.map((offset) => source[offset]).join(""),
      block.text.replace(/\s/g, ""),
    );
  assert.ok(result.blocks[1].start > result.blocks[0].start);
  assert.equal(result.blocks[0].end, result.blocks[1].start);
});
test("quebras físicas e macros de formatação mantêm correspondência exata sem modificar TeX", () => {
  const source = String.raw`\section{Método}
Texto com \textbf{ênfase} que tem
uma quebra física no fonte.

Outro parágrafo.
`;
  const content = projectLatex(source).doc;
  const before = JSON.stringify(content);
  const result = latexAlignment(content, source);
  assert.equal(result.error, undefined);
  assert.equal(result.blocks[0].start, 0);
  for (const block of result.blocks)
    assert.equal(
      block.offsets.map((offset) => source[offset]).join(""),
      block.text.replace(/\s/g, ""),
    );
  assert.equal(JSON.stringify(content), before);
});
test("comentários e delimitadores matemáticos ficam contidos nos intervalos do fonte original", () => {
  const source = String.raw`% comentário preservado
\section{Método}
Texto com $\eta_t$.

\begin{equation}
\eta_t=\frac{1}{t}
\end{equation}
`;
  const result = latexAlignment(projectLatex(source).doc, source);
  assert.equal(result.error, undefined);
  assert.equal(result.blocks[0].start, 0);
  assert.equal(result.blocks.at(-1)?.atomic, true);
  assert.equal(
    result.blocks.map((b) => source.slice(b.start, b.end)).join(""),
    source,
  );
});
test("visualização divergente ou macro desconhecida não recebe um alinhamento aproximado", () => {
  assert.ok(
    latexAlignment(
      { type: "doc", content: [paragraph("Ainda não salvo")] },
      "Texto salvo.\n\n",
    ).error,
  );
  assert.ok(
    latexAlignment(
      { type: "doc", content: [paragraph("Texto")] },
      "\\comando{Texto}",
    ).error,
  );
});
test("raw TeX preservado mantém cada offset mesmo com construções arbitrárias", () => {
  const source = String.raw`\newcommand{\nome}{Laura}
\begin{document}
\nome
\end{document}`;
  const content = projectLatex(source).doc;
  const result = latexAlignment(content, source);
  assert.equal(result.error, undefined);
  assert.equal(
    result.blocks[0].offsets.map((i) => source[i]).join(""),
    source.replace(/\s/g, ""),
  );
});
test("citação e nota não trocam fonte por metadados visuais nem removem seu código", () => {
  const content: Doc = {
    type: "doc",
    content: [
      {
        ...paragraph(""),
        content: [
          { type: "text", text: "Texto & revisão " },
          {
            type: "citation",
            attrs: { key: "fonte2024", label: "(Autora, 2024)" },
          },
          { type: "footnote", attrs: { number: 1, text: "Nota." } },
        ],
      },
    ],
  };
  const source = exportLatex(content);
  const result = latexAlignment(content, source);
  assert.equal(result.error, undefined);
  assert.ok(
    source
      .slice(result.blocks[0].start, result.blocks[0].end)
      .includes("\\footnote{Nota.}"),
  );
});
