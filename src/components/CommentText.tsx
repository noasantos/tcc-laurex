import { useEffect, useRef, useState, useId } from "react";
import { commentPreview } from "./commentPreview";

export function CommentText({
  text,
  quote = false,
  limit = 320,
}: {
  text: string;
  quote?: boolean;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const body = useRef<HTMLParagraphElement>(null);
  const contentId = useId();
  const preview = commentPreview(text, limit);
  useEffect(() => {
    const node = body.current;
    if (!node) return;
    const measure = () => setClipped(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text, expanded]);
  return (
    <div
      className={
        "comment-text " +
        (quote ? "comment-excerpt " : "") +
        (expanded ? "is-expanded" : "")
      }
    >
      {quote && <span className="comment-text-label">Trecho marcado</span>}
      <p ref={body} id={contentId}>
        {expanded ? text : preview.text}
      </p>
      {(preview.truncated || clipped || expanded) && (
        <button
          type="button"
          className="text-button comment-read-more"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? quote
              ? "Recolher trecho"
              : "Recolher comentário"
            : quote
              ? "Ler trecho completo"
              : "Ler comentário completo"}
        </button>
      )}
    </div>
  );
}
