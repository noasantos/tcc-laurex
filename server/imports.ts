import { unzipSync } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import { paragraph, type Doc } from "./types";
export function unpack(buffer: Buffer) {
  if (buffer.length > 8 * 1024 * 1024)
    throw new Error("Arquivo deve ter no máximo 8 MB");
  let total = 0;
  const files = unzipSync(buffer, {
    filter(file) {
      if (
        file.name.startsWith("/") ||
        file.name.includes("\\") ||
        file.name.split("/").includes("..")
      )
        throw new Error("Caminho não permitido dentro do arquivo");
      total += file.originalSize;
      if (total > 30 * 1024 * 1024 || file.originalSize > 10 * 1024 * 1024)
        throw new Error("Arquivo descompactado excede o limite seguro");
      return true;
    },
  });
  if (Object.keys(files).length > 500)
    throw new Error("Máximo de 500 arquivos por importação");
  return files;
}
export function importWord(buffer: Buffer): { doc: Doc; warnings: string[] } {
  const files = unpack(buffer);
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Arquivo Word .docx inválido");
  const source = new TextDecoder().decode(xml);
  if (source.includes("<!DOCTYPE") || source.includes("<!ENTITY"))
    throw new Error("Entidades externas não são permitidas");
  const document = new DOMParser().parseFromString(source, "text/xml");
  const paragraphs = Array.from(document.getElementsByTagName("w:p"));
  const blocks: Doc[] = paragraphs.map((p) => {
    const text = Array.from(p.getElementsByTagName("w:t"))
      .map((t) => t.textContent || "")
      .join("");
    return paragraph(text);
  });
  return {
    doc: { type: "doc", content: blocks.length ? blocks : [paragraph("")] },
    warnings: [
      "Importação Word como texto: formatação, campos bibliográficos, tabelas, equações e figuras ficam preservados apenas no original .docx. Confira o resultado antes de utilizá-lo como texto acadêmico.",
    ],
  };
}
