import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { mkdirSync, readFileSync, mkdtempSync } from "node:fs";
import { atomic, type Store } from "./store";
import { safeMath } from "./export";
import { exportLatex } from "./documents";
export async function compiler() {
  for (const command of ["tectonic", "pdflatex", "xelatex"]) {
    try {
      await run(command, ["--version"], undefined, 5000);
      return command;
    } catch {}
  }
  return null;
}
export function run(
  command: string,
  args: string[],
  cwd?: string,
  timeout = 45000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, openin_any: "p", openout_any: "p" },
    });
    let out = "";
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error("Compilação excedeu o tempo limite"));
    }, timeout);
    p.stdout.on("data", (b) => {
      if (out.length < 100000) out += b;
    });
    p.stderr.on("data", (b) => {
      if (out.length < 100000) out += b;
    });
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out)
        : reject(
            new Error(
              out.slice(-8000) || `Compilador terminou com código ${code}`,
            ),
          );
    });
  });
}
export async function compile(store: Store) {
  const cmd = await compiler();
  if (!cmd)
    throw new Error(
      "Nenhum compilador LaTeX encontrado. A leitura, revisão e exportação continuam disponíveis.",
    );
  const state = store.get();
  for (const c of state.chapters) safeMath(c.content);
  const assets: Record<string, Uint8Array> = {};
  const content = state.chapters
    .map(
      (c) =>
        `\\section{${c.title.replace(/[{}\\%]/g, "")}}\n${exportLatex(c.content, assets)}`,
    )
    .join("\n");
  // Imported arbitrary TeX is preserved but never executed. Only our strict exporter may compile.
  if (
    state.chapters.some((c) => JSON.stringify(c.content).includes("rawLatex"))
  )
    throw new Error(
      "Este projeto contém LaTeX preservado. Compile o original na sua ferramenta LaTeX; a compilação automática aceita apenas o subconjunto visual seguro.",
    );
  const tex = `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\begin{document}\n${content}\n\\end{document}`;
  // Math is free-form TeX: forbid filesystem, expansion and dynamic control sequences.
  if (
    /\\(?:input|include|write|read|openin|openout|catcode|csname|def|let|special|usepackage|documentclass|directlua|immediate|loop|newcommand|every|scantokens|endlinechar)\b/.test(
      content,
    )
  )
    throw new Error(
      "Comando TeX não permitido na compilação visual. Exporte e revise na ferramenta LaTeX.",
    );
  const root = join(store.root, "academic", "renders");
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "pdf-"));
  atomic(join(dir, "main.tex"), tex);
  for (const [name, bytes] of Object.entries(assets)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    atomic(join(dir, name), Buffer.from(bytes));
  }
  const args =
    cmd === "tectonic"
      ? ["--untrusted", "--outdir", dir, join(dir, "main.tex")]
      : [
          "-no-shell-escape",
          "-interaction=nonstopmode",
          "-halt-on-error",
          "main.tex",
        ];
  await run(cmd, args, dir);
  return readFileSync(join(dir, "main.pdf"));
}
