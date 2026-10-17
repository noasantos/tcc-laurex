import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { paragraph } from "../server/types";
if (!process.env.LAURA_DATA_DIR)
  throw new Error(
    "Use LAURA_DATA_DIR explícito para uma demonstração separada; este script não altera o projeto normal.",
  );
const s = new Store();
if (s.get().chapters.length)
  throw new Error("A demonstração exige uma pasta vazia.");
const d = new Domain(s);
const call = (name: any, args: any) =>
  d.call(name, { expectedRevision: s.get().revision, ...args });
call("update_settings", { name: "Meu TCC · demonstração" });
let intro: any;
for (const title of [
  "1. Introdução",
  "2. Referencial teórico",
  "3. Metodologia",
  "4. Resultados",
  "5. Considerações finais",
]) {
  const c = call("create_chapter", {
    title,
    ...(title.startsWith("1.")
      ? {
          content: {
            type: "doc",
            content: [
              paragraph(
                "O presente trabalho busca investigar os principais aspectos relacionados ao tema, considerando as contribuições recentes da literatura acadêmica.",
              ),
              paragraph(
                "Diferentes abordagens teóricas permitem compreender a evolução desse fenômeno.",
              ),
              paragraph(
                "A análise será desenvolvida a partir de uma revisão crítica dos estudos selecionados…",
              ),
            ],
          },
        }
      : {}),
  }).result;
  if (title.startsWith("1.")) intro = c;
}
call("create_comment", {
  chapterId: intro.id,
  body: "Verificar referência bibliográfica",
  quote: intro.content.content[1].content[0].text,
  anchor: { blockId: intro.content.content[1].attrs.id, scope: "paragraph" },
});
s.close();
