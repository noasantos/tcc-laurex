import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Comment } from "../../server/types";
import {
  commentReference,
  commentReferenceRequest,
} from "../../server/comment-reference";
export function CopyCommentReference({ comment }: { comment: Comment }) {
  const [state, setState] = useState<"ready" | "copied" | "error">("ready");
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reset.current) clearTimeout(reset.current);
    },
    [],
  );
  return (
    <div className="comment-copy">
      <button
        type="button"
        className="text-button"
        title="Copiar referência e pedido para o ChatGPT"
        aria-label={`Copiar referência ${commentReference(comment.id)} para o ChatGPT`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              commentReferenceRequest(comment),
            );
            setState("copied");
            if (reset.current) clearTimeout(reset.current);
            reset.current = setTimeout(() => setState("ready"), 2200);
          } catch {
            setState("error");
          }
        }}
      >
        {state === "copied" ? <Check size={13} /> : <Copy size={13} />}
        {state === "copied"
          ? "Copiado para o ChatGPT"
          : commentReference(comment.id)}
      </button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Referência copiada. Cole na conversa do TCC."
          : ""}
      </span>
      {state === "error" && (
        <small role="alert">
          Não foi possível copiar. Selecione a referência acima e copie
          manualmente.
        </small>
      )}
    </div>
  );
}
