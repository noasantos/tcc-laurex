import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Comment } from "../../server/types";
import { commentReferenceRequest } from "../../server/comment-reference";
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
    <div className="comment-copy" data-hint="reference">
      <button
        type="button"
        className="text-button comment-copy-button"
        data-copy-state={state}
        title="Copiar pedido para a conversa do TCC"
        aria-label={state === "copied" ? "Copiado" : "Copiar referência"}
        onClick={async () => {
          if (reset.current) clearTimeout(reset.current);
          try {
            await navigator.clipboard.writeText(commentReferenceRequest(comment));
            setState("copied");
            reset.current = setTimeout(() => setState("ready"), 2200);
          } catch {
            setState("error");
          }
        }}
      >
        <span className="comment-copy-swap comment-copy-icons" aria-hidden="true">
          <Copy size={13} className="comment-copy-ready" />
          <Check size={13} className="comment-copy-success" />
        </span>
        <span className="comment-copy-swap" aria-hidden="true">
          <span className="comment-copy-ready">Copiar referência</span>
          <span className="comment-copy-success">Copiado</span>
        </span>
      </button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Pedido copiado. Cole na conversa do TCC."
          : ""}
      </span>
      {state === "error" && (
        <small role="alert">Não foi possível copiar. Tente novamente.</small>
      )}
    </div>
  );
}
