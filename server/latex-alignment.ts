import { parse } from "@unified-latex/unified-latex-util-parse";
import { toString } from "@unified-latex/unified-latex-util-to-string";
import { validateDoc } from "./documents";
import { plain, type Doc } from "./types";

export type AlignedBlock = {
  index: number;
  start: number;
  end: number;
  offsets: number[];
  text: string;
  atomic: boolean;
};
/** Literal source offsets, never a proportional scroll estimate or a rewritten TeX document. */
export function latexAlignment(
  content: Doc,
  source: string,
): { blocks: AlignedBlock[]; error?: string } {
  validateDoc(content);
  const docBlocks = content.content || [];
  if (
    docBlocks.length === 1 &&
    docBlocks[0].type === "rawLatex" &&
    docBlocks[0].attrs?.source === source
  )
    return {
      blocks: [
        {
          index: 0,
          start: 0,
          end: source.length,
          text: source,
          offsets: Array.from({ length: source.length }, (_, i) => i).filter(
            (i) => !/\s/.test(source[i]),
          ),
          atomic: false,
        },
      ],
    };
  type Character = { char: string; offset: number; root: number };
  const characters: Character[] = [];
  const citations: Doc[] = [];
  const gather = (d: Doc) => {
    if (d.type === "citation") citations.push(d);
    for (const child of d.content || []) gather(child);
  };
  gather(content);
  let citationIndex = 0;
  const emit = (
    text: string,
    offset: number,
    root: number,
    literal = false,
  ) => {
    for (let i = 0; i < text.length; i++)
      if (!/\s/.test(text[i]))
        characters.push({
          char: text[i],
          offset: literal ? offset + i : offset,
          root,
        });
  };
  const wholeStart = (n: any) => n.position?.start?.offset;
  function walk(nodes: any[], root?: number) {
    for (const n of nodes) {
      const start = wholeStart(n);
      if (n.type === "string") {
        emit(n.content, start, root ?? start, true);
        continue;
      }
      if (["whitespace", "parbreak", "comment"].includes(n.type)) continue;
      if (n.type === "group") {
        walk(n.content, root ?? start);
        continue;
      }
      if (["inlinemath", "displaymath", "mathenv"].includes(n.type)) {
        emit(toString(n.content), start, root ?? start);
        continue;
      }
      if (n.type === "macro") {
        const arg = (n.args || []).find((a: any) => a.openMark === "{");
        if (
          [
            "section",
            "subsection",
            "subsubsection",
            "chapter",
            "textbf",
            "textit",
            "emph",
            "underline",
            "texttt",
          ].includes(n.content)
        ) {
          walk(arg?.content || [], root ?? start);
          continue;
        }
        if (["cite", "citep", "citet"].includes(n.content)) {
          const citation = citations[citationIndex++];
          if (!citation || citation.attrs?.key !== toString(arg?.content || []))
            throw new Error("A citação visual não corresponde ao fonte salvo.");
          emit(plain(citation), start, root ?? start);
          continue;
        }
        if (n.content === "footnote") continue;
        if (
          ["item", "hline", "ttfamily", "centering", "\\"].includes(n.content)
        )
          continue;
        if (["%", "$", "#", "_", "{", "}"].includes(n.content)) {
          emit(n.content, start, root ?? start);
          continue;
        }
        if (n.content === "&") {
          if (n.escapeToken !== "") emit("&", start, root ?? start);
          continue;
        }
        throw new Error(
          "Construção sem correspondência visual: \\" + n.content,
        );
      }
      if (n.type === "environment") {
        const env = toString(n.env);
        if (["itemize", "enumerate", "quote", "tabular"].includes(env)) {
          walk(n.content);
          continue;
        }
        if (env === "figure") {
          emit("\uFFFC", start, start);
          continue;
        }
      }
      throw new Error(
        "Esta construção precisa ser consultada no código original.",
      );
    }
  }
  try {
    walk(parse(source).content);
    let cursor = 0;
    const blocks: AlignedBlock[] = docBlocks.map((block, index) => {
      const text = block.type === "image" ? "\uFFFC" : plain(block);
      const visible = text.replace(/\s/g, "");
      const mapped = characters.slice(cursor, cursor + visible.length);
      if (mapped.map((c) => c.char).join("") !== visible)
        throw new Error(
          "A visualização e o fonte salvo ainda não correspondem. Aguarde o salvamento para alinhar.",
        );
      cursor += visible.length;
      return {
        index,
        start: mapped[0]?.root ?? characters[cursor]?.root ?? source.length,
        end: source.length,
        text,
        offsets: mapped.map((c) => c.offset),
        atomic: ["blockMath", "image", "table"].includes(block.type),
      };
    });
    if (cursor !== characters.length)
      throw new Error(
        "O fonte contém conteúdo sem correspondência visual segura.",
      );
    for (let i = 0; i < blocks.length; i++) {
      blocks[i].end = blocks[i + 1]?.start ?? source.length;
      if (i === 0) blocks[i].start = 0;
    }
    return { blocks };
  } catch (error) {
    return { blocks: [], error: (error as Error).message };
  }
}
