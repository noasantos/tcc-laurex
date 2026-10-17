import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commentReference,
  commentReferenceRequest,
  findCommentReference,
} from "../server/comment-reference";
import type { Comment } from "../server/types";
const a = {
  id: "abcdef01-0000-4000-8000-000000000001",
  chapterId: "chapter-1",
  body: "Orientação privada",
  quote: "Texto acadêmico privado",
} as Comment;
const b = { ...a, id: "abcdef01-0000-4000-8000-000000000002" };
test("referência curta é estável e consulta aceita ID completo, referência e hashtag", () => {
  assert.equal(commentReference(a.id), "C-abcdef01");
  assert.equal(findCommentReference([a], "C-abcdef01"), a);
  assert.equal(findCommentReference([a], "#c-ABCDEF01"), a);
  assert.equal(findCommentReference([a], a.id), a);
  assert.throws(
    () => findCommentReference([a], "C-12345678"),
    /não encontrado/,
  );
});
test("colisão de referência nunca escolhe um comentário arbitrariamente", () => {
  assert.throws(() => findCommentReference([a, b], "C-abcdef01"), /ambígua/);
  assert.equal(findCommentReference([a, b], b.id), b);
});
test("pedido copiado contém ferramenta e ID exato sem copiar conteúdo acadêmico", () => {
  const request = commentReferenceRequest(a);
  assert.ok(request.includes("get_comment_context"));
  assert.ok(request.includes(a.id));
  assert.ok(request.includes(a.chapterId));
  assert.ok(!request.includes(a.body));
  assert.ok(!request.includes(a.quote));
});
