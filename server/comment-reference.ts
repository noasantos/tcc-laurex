import type { Comment } from "./types";
export const commentReference = (commentId: string) =>
  "C-" + commentId.replaceAll("-", "").slice(0, 8).toLowerCase();
export function findCommentReference(
  comments: Comment[],
  input: string,
): Comment {
  const value = input.trim().replace(/^#/, "");
  const exact = comments.find((comment) => comment.id === value);
  if (exact) return exact;
  const match = /^C-([0-9a-f]{8})$/i.exec(value);
  const found = match
    ? comments.filter(
        (comment) =>
          commentReference(comment.id).toLowerCase() === value.toLowerCase(),
      )
    : [];
  if (found.length > 1)
    throw new Error(
      "Referência de comentário ambígua. Use o ID completo incluído no pedido copiado.",
    );
  if (!found.length)
    throw new Error(
      "Comentário não encontrado neste projeto. Confira a referência e o projeto conectado.",
    );
  return found[0];
}
export function commentReferenceRequest(
  comment: Pick<Comment, "id" | "chapterId">,
) {
  return `No LAUREX, consulte o comentário ${commentReference(comment.id)} usando get_comment_context com commentId: "${comment.id}" (capítulo ${comment.chapterId}). Leia o trecho marcado, a localização atual, as respostas e o histórico antes de propor uma revisão.`;
}
