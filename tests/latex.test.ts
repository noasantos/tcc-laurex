import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import { Domain } from "../server/domain";
import { compiler, compile } from "../server/latex";
import { paragraph } from "../server/types";
import { unpack, importWord } from "../server/imports";
import { zipSync, strToU8 } from "fflate";
test("compilação real de PDF pelo compilador local", async (t) => {
  if (!(await compiler())) {
    t.skip("Nenhum compilador local instalado neste sistema");
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "laura-pdf-")),
    s = new Store(root);
  try {
    const d = new Domain(s);
    d.call("create_chapter", {
      expectedRevision: s.get().revision,
      title: "Introdução",
      content: {
        type: "doc",
        content: [paragraph("Conteúdo acadêmico de teste.")],
      },
    });
    const pdf = await compile(s);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 1000);
  } finally {
    s.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test("arquivo Word importado como texto; originais complexos não fingem conversão fiel", () => {
  const zip = Buffer.from(
    zipSync({
      "word/document.xml": strToU8(
        '<?xml version="1.0"?><w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>Um texto acadêmico.</w:t></w:r></w:p></w:body></w:document>',
      ),
    }),
  );
  const r = importWord(zip);
  assert.equal(r.doc.content![0].content![0].text, "Um texto acadêmico.");
  assert.ok(r.warnings.length);
});
test("caminhos de escape em projetos ZIP são bloqueados antes da importação", () => {
  const zip = Buffer.from(zipSync({ "../escape.tex": strToU8("conteúdo") }));
  assert.throws(() => unpack(zip), /Caminho não permitido/);
});
