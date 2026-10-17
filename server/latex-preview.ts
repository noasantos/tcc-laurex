import { exportLatex, validateDoc } from "./documents";
import type { Doc } from "./types";

/** Read-only projection. Never parses the result back into the academic source. */
export function latexPreview(content: Doc) {
  validateDoc(content);
  const assets: Record<string, Uint8Array> = {};
  return (content.content || []).map((block, index) => {
    try {
      return { index, code: exportLatex(block, assets), error: null };
    } catch (error) {
      return {
        index,
        code: "",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível visualizar este bloco.",
      };
    }
  });
}
