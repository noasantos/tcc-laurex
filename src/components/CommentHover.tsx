import { useRef } from "react";
import type { Comment } from "../../server/types";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "./ui/popover";
import { CopyCommentReference } from "./CopyCommentReference";
import { commentPreview } from "./commentPreview";

export function CommentHover({
  comment,
  rect,
  onOpen,
  onClose,
  onEnter,
  onLeave,
}: {
  comment: Comment;
  rect: DOMRect;
  onOpen: () => void;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const anchor = useRef({ getBoundingClientRect: () => rect });
  anchor.current.getBoundingClientRect = () => rect;
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        className="comment-hover max-w-[calc(100vw-24px)]"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Prévia do comentário"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <PopoverHeader>
          <PopoverTitle>
            {comment.author || "Laura"}{" "}
            <span>
              {comment.status === "resolved" ? "Resolvido" : "Comentário"}
            </span>
          </PopoverTitle>
        </PopoverHeader>
        <p className="comment-hover-body">
          {commentPreview(comment.body, 280).text}
        </p>
        <div className="comment-hover-actions">
          <button type="button" className="text-button" onClick={onOpen}>
            Abrir comentário
          </button>
          <CopyCommentReference comment={comment} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
