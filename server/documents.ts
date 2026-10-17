import { parse } from "@unified-latex/unified-latex-util-parse";
import { toString } from "@unified-latex/unified-latex-util-to-string";
import type { Doc } from "./types";
import { paragraph } from "./types";
const supported = new Set([
  "textbf",
  "textit",
  "emph",
  "section",
  "subsection",
  "subsubsection",
  "cite",
  "citep",
  "citet",
  "footnote",
]);
export function importLatex(source: string): { doc: Doc; warnings: string[] } {
  const ast = parse(source);
  const warnings: string[] = [];
  function inspect(nodes: any[]) {
    for (const n of nodes) {
      if (
        !["string", "whitespace", "parbreak", "group", "macro"].includes(n.type)
      )
        warnings.push("Construção preservada: " + n.type);
      if (n.type === "macro") {
        if (!supported.has(n.content))
          warnings.push("Comando preservado: \\" + n.content);
        for (const arg of n.args || []) {
          if (arg.openMark !== "{" && arg.content?.length)
            warnings.push("Argumento opcional preservado: " + n.content);
          inspect(arg.content || []);
        }
      }
      if (Array.isArray(n.content)) inspect(n.content);
    }
  }
  inspect(ast.content);
  if (warnings.length)
    return {
      doc: {
        type: "doc",
        content: [
          { type: "rawLatex", attrs: { id: crypto.randomUUID(), source } },
        ],
      },
      warnings: [...new Set(warnings)],
    };
  const blocks: Doc[] = [];
  let inline: Doc[] = [];
  let note = 0;
  const flush = () => {
    if (inline.length) {
      blocks.push({ ...paragraph(""), content: inline });
      inline = [];
    }
  };
  function convertInline(nodes: any[]): Doc[] {
    return nodes.flatMap((n): Doc[] => {
      if (n.type === "string")
        return n.content ? [{ type: "text", text: n.content }] : [];
      if (n.type === "whitespace") return [{ type: "text", text: " " }];
      if (n.type === "group") return convertInline(n.content);
      if (n.type === "macro") {
        const a =
          (n.args || []).find((a: any) => a.openMark === "{")?.content || [];
        const value = toString(a);
        if (n.content.startsWith("cite"))
          return [{ type: "citation", attrs: { key: value, label: value } }];
        if (n.content === "footnote")
          return [
            {
              type: "footnote",
              attrs: { id: crypto.randomUUID(), number: ++note, text: value },
            },
          ];
        return convertInline(a).map((c) => ({
          ...c,
          marks: [
            ...(c.marks || []),
            { type: n.content === "textbf" ? "bold" : "italic" },
          ],
        }));
      }
      return [];
    });
  }
  for (const n of ast.content) {
    if (n.type === "parbreak") {
      flush();
      continue;
    }
    if (
      n.type === "macro" &&
      ["section", "subsection", "subsubsection"].includes(n.content)
    ) {
      flush();
      const a =
        (n.args || []).find((a: any) => a.openMark === "{")?.content || [];
      blocks.push({
        type: "heading",
        attrs: {
          id: crypto.randomUUID(),
          level:
            ["section", "subsection", "subsubsection"].indexOf(n.content) + 1,
        },
        content: convertInline(a),
      });
    } else inline.push(...convertInline([n]));
  }
  flush();
  return {
    doc: { type: "doc", content: blocks.length ? blocks : [paragraph("")] },
    warnings: [],
  };
}
const esc = (s: string) =>
  s.replace(
    /[\\{}$&#%_~^]/g,
    (c) =>
      ({
        "\\": "\\textbackslash{}",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      })[c] || "\\" + c,
  );
export function exportLatex(
  d: Doc,
  assets?: Record<string, Uint8Array>,
): string {
  if (d.type === "rawLatex") return String(d.attrs?.source ?? "");
  if (d.type === "text") {
    let t = esc(d.text || "");
    for (const m of d.marks || []) {
      const command: Record<string, string> = {
        bold: "textbf",
        italic: "emph",
        underline: "underline",
        code: "texttt",
      };
      if (command[m.type]) t = `\\${command[m.type]}{${t}}`;
      else if (m.type === "link")
        t = `\\href{${esc(String(m.attrs?.href || ""))}}{${t}}`;
      else
        throw new Error("Estilo não suportado na exportação LaTeX: " + m.type);
    }
    return t;
  }
  if (d.type === "citation") {
    const key = String(d.attrs?.key || "");
    if (!key.split(",").every((k) => /^[A-Za-z0-9_:+.\/-]+$/.test(k)))
      throw new Error("Chave bibliográfica inválida");
    return `\\cite{${key}}`;
  }
  if (d.type === "footnote")
    return `\\footnote{${esc(String(d.attrs?.text || ""))}}`;
  if (d.type === "crossReference") return esc(String(d.attrs?.label || ""));
  if (d.type === "hardBreak") return "\\\\n";
  if (d.type === "horizontalRule") return "\\hrule\n";
  if (d.type === "inlineMath") return `$${d.attrs?.latex || ""}$`;
  if (d.type === "blockMath") return `\\[${d.attrs?.latex || ""}\\]`;
  if (d.type === "table") {
    const rows = d.content || [],
      cols = rows[0]?.content?.length || 0;
    if (
      !cols ||
      rows.some(
        (r) =>
          r.content?.length !== cols ||
          r.content.some(
            (c) =>
              Number(c.attrs?.colspan || 1) !== 1 ||
              Number(c.attrs?.rowspan || 1) !== 1,
          ),
      )
    )
      throw new Error(
        "Tabela com células mescladas requer revisão no LaTeX original",
      );
    const col = "p{" + (0.9 / cols).toFixed(3) + "\\linewidth}";
    return (
      "\\begin{tabular}{" +
      Array(cols).fill(col).join("|") +
      "}\n" +
      rows
        .map((r) =>
          r
            .content!.map((c) =>
              c
                .content!.map((n) => exportLatex(n, assets))
                .join("")
                .trim(),
            )
            .join(" & "),
        )
        .join(" \\\\ \n") +
      " \\\\ \n\\end{tabular}\n"
    );
  }
  if (d.type === "image") {
    if (!assets)
      throw new Error("Figuras exigem a exportação do pacote acadêmico ZIP");
    const match = String(d.attrs?.src || "").match(
      /^data:image\/(png|jpeg);base64,(.+)$/s,
    );
    if (!match)
      throw new Error("Para exportar ao LaTeX, use figuras PNG ou JPEG");
    const name =
      "figures/figure-" +
      (Object.keys(assets).filter((k) => k.startsWith("figures/")).length + 1) +
      "." +
      (match[1] === "jpeg" ? "jpg" : "png");
    assets[name] = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return `\\begin{figure}[ht]\n\\centering\n\\includegraphics[width=0.9\\linewidth]{${name}}\n${d.attrs?.title ? "\\caption{" + esc(String(d.attrs.title)) + "}" : ""}\n\\end{figure}\n`;
  }
  const body = (d.content || []).map((c) => exportLatex(c, assets)).join("");
  if (d.type === "heading")
    return `\\${["section", "subsection", "subsubsection"][Math.min(3, Number(d.attrs?.level || 1)) - 1]}{${body}}\n\n`;
  if (d.type === "paragraph") return body + "\n\n";
  if (d.type === "bulletList" || d.type === "orderedList")
    return `\\begin{${d.type === "bulletList" ? "itemize" : "enumerate"}}\n${body}\\end{${d.type === "bulletList" ? "itemize" : "enumerate"}}\n`;
  if (d.type === "listItem") return "\\item " + body;
  if (d.type === "blockquote")
    return "\\begin{quote}" + body + "\\end{quote}\n";
  if (d.type === "codeBlock")
    return "\\begin{quote}\\ttfamily " + body + "\\end{quote}\n";
  if (d.type === "doc") return body;
  throw new Error(
    "Exportação LaTeX bloqueada para " +
      d.type +
      ". Exporte o projeto JSON para preservar todo o conteúdo.",
  );
}
export function validateDoc(doc: Doc) {
  let count = 0;
  const ids = new Set<string>();
  function visit(d: Doc, depth = 0) {
    if (depth > 30 || ++count > 50000)
      throw new Error("Documento excede os limites");
    if (
      ![
        "doc",
        "paragraph",
        "heading",
        "text",
        "bold",
        "italic",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
        "hardBreak",
        "horizontalRule",
        "codeBlock",
        "table",
        "tableRow",
        "tableCell",
        "tableHeader",
        "image",
        "citation",
        "footnote",
        "rawLatex",
        "inlineMath",
        "blockMath",
        "crossReference",
      ].includes(d.type)
    )
      throw new Error("Tipo de conteúdo não suportado: " + d.type);
    if (
      d.type === "image" &&
      !/^data:image\/(png|jpeg|webp);base64,/.test(String(d.attrs?.src))
    )
      throw new Error("Use uma imagem local PNG, JPEG ou WebP");
    const inline = [
      "text",
      "hardBreak",
      "citation",
      "footnote",
      "inlineMath",
      "crossReference",
    ];
    const block = [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "horizontalRule",
      "codeBlock",
      "table",
      "image",
      "rawLatex",
      "blockMath",
    ];
    if (
      ["paragraph", "heading"].includes(d.type) &&
      (d.content || []).some((c) => !inline.includes(c.type))
    )
      throw new Error("Um parágrafo só pode conter texto e elementos em linha");
    if (
      d.type === "doc" &&
      (d.content || []).some((c) => !block.includes(c.type))
    )
      throw new Error("Estrutura de documento inválida");
    if (d.type === "text" && (!d.text || d.content))
      throw new Error("Nó de texto inválido");
    if (
      d.type === "heading" &&
      ![1, 2, 3, 4, 5, 6].includes(Number(d.attrs?.level))
    )
      throw new Error("Nível de título inválido");
    if (
      ["bulletList", "orderedList"].includes(d.type) &&
      (d.content || []).some((c) => c.type !== "listItem")
    )
      throw new Error("Estrutura de lista inválida");
    if (
      d.type === "table" &&
      (d.content || []).some((c) => c.type !== "tableRow")
    )
      throw new Error("Estrutura de tabela inválida");
    if (
      d.type === "tableRow" &&
      (d.content || []).some(
        (c) => !["tableCell", "tableHeader"].includes(c.type),
      )
    )
      throw new Error("Célula inválida");
    if (
      ["listItem", "tableCell", "tableHeader", "blockquote"].includes(d.type) &&
      (d.content || []).some((c) => !block.includes(c.type))
    )
      throw new Error("Conteúdo de bloco inválido");
    if (d.type === "rawLatex" && typeof d.attrs?.source !== "string")
      throw new Error("Original LaTeX inválido");
    if (d.attrs?.id) {
      if (ids.has(d.attrs.id))
        throw new Error("Identificador estrutural duplicado");
      ids.add(d.attrs.id);
    }
    for (const m of d.marks || []) {
      if (
        !["bold", "italic", "strike", "code", "link", "underline"].includes(
          m.type,
        )
      )
        throw new Error("Estilo não suportado");
      if (m.type === "link" && !/^https?:\/\//.test(String(m.attrs?.href)))
        throw new Error("Link deve usar HTTP ou HTTPS");
    }
    for (const c of d.content || []) visit(c, depth + 1);
  }
  if (doc.type !== "doc") throw new Error("Documento inválido");
  visit(doc);
}
