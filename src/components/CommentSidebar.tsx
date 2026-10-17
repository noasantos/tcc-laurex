import { useEffect, useState, type ReactNode } from "react";
export function CommentSidebar({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(timer);
  }, [open]);
  return (
    <aside
      className="context-panel animated-comments"
      data-open={open}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="comment-sidebar-body">{mounted ? children : null}</div>
    </aside>
  );
}
