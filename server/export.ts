import { zipSync, strToU8 } from "fflate";
import { exportLatex } from "./documents";
import type { State, Doc } from "./types";
export function academicPackage(state: State) {
  const files: Record<string, Uint8Array> = {};
  const bibliography = [
    ...new Set(
      state.references.map(
        (r) =>
          r.bibtex ||
          `@${r.type === "book" ? "book" : "article"}{${r.key},\n title={${r.title}},\n author={${r.authors}},\n year={${r.year}}\n}`,
      ),
    ),
  ].join("\n\n");
  files["references.bib"] = strToU8(bibliography);
  const chapterFiles = state.chapters
    .map((c, i) => {
      const name = `chapter-${String(c.number ?? i + 1).padStart(2, "0")}.tex`;
      const generated = exportLatex(c.content, files, `figures/${encodeURIComponent(c.id)}/`);
      files[name] = strToU8(c.latex ?? generated);
      return `% Capítulo ${c.number ?? i + 1}: ${c.title.replaceAll("\n", " ")}\n\\input{${name}}`;
    })
    .join("\n");
  files["chapters.tex"] = strToU8(chapterFiles);
  files["README.txt"] = strToU8(
    "Conteúdo acadêmico exportado separadamente do planejamento, notas e comentários.\nArquivos LaTeX preservados podem já conter preâmbulo e documentclass; revise a estrutura antes de incluir em outro projeto.\nEste pacote não certifica conformidade ABNT/UFRJ. Mantenha a formatação institucional no projeto original.\n",
  );
  return zipSync(files);
}
export function safeMath(doc: Doc) {
  const allowed = new Set([
    "frac",
    "sqrt",
    "sum",
    "prod",
    "int",
    "lim",
    "infty",
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "theta",
    "lambda",
    "mu",
    "pi",
    "sigma",
    "omega",
    "Gamma",
    "Delta",
    "Theta",
    "Lambda",
    "Pi",
    "Sigma",
    "Omega",
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
    "exp",
    "left",
    "right",
    "mathrm",
    "mathbf",
    "mathit",
    "mathbb",
    "mathcal",
    "text",
    "cdot",
    "times",
    "div",
    "pm",
    "mp",
    "le",
    "leq",
    "ge",
    "geq",
    "ne",
    "neq",
    "approx",
    "equiv",
    "in",
    "notin",
    "subset",
    "subseteq",
    "cup",
    "cap",
    "forall",
    "exists",
    "rightarrow",
    "leftarrow",
    "to",
    "vec",
    "hat",
    "bar",
    "dot",
    "dots",
    "ldots",
    "cdots",
    "overline",
    "underline",
    "partial",
    "nabla",
    "underbrace",
    "overbrace",
    "displaystyle",
    "textstyle",
    "quad",
    "qquad",
  ]);
  function walk(d: Doc) {
    if (["inlineMath", "blockMath"].includes(d.type)) {
      const s = String(d.attrs?.latex || "");
      if (s.length > 5000 || s.includes("^^"))
        throw new Error("Expressão matemática excede o subconjunto seguro");
      for (const match of s.matchAll(/\\([a-zA-Z]+|.)/g)) {
        if (/^[a-zA-Z]+$/.test(match[1]) && !allowed.has(match[1]))
          throw new Error("Comando matemático não permitido: " + match[1]);
      }
    }
    for (const c of d.content || []) walk(c);
  }
  walk(doc);
}
