import { useEffect, useRef } from "react";
import {
  locationKey,
  resumeKey,
  type WorkspaceLocation,
  type WorkspaceResume,
  type ScrollPosition,
} from "./workspace-resume";

// Stable regions, independent of document text, paragraph count and generated editor IDs.
const regions = [
  ".main-content",
  ".main-content > .collection",
  ".main-content > .review-panel",
  ".document-reading-layout",
  ".document-body",
  ".cm-scroller",
  ".latex-source",
  ".comments-list",
  ".reference-list",
  ".reference-inspector",
  ".sidebar nav",
  ".context-panel .review-panel",
];
function panes() {
  const result = new Map<string, HTMLElement>();
  const seen = new Set<HTMLElement>();
  for (const selector of regions)
    document
      .querySelectorAll<HTMLElement>(selector)
      .forEach((element, index) => {
        if (!seen.has(element)) {
          result.set(selector + ":" + index, element);
          seen.add(element);
        }
      });
  return result;
}
export function useWorkspaceResume(
  projectId: string | undefined,
  location: WorkspaceLocation,
  initial: WorkspaceResume | null,
) {
  const pending = useRef(initial);
  const key = locationKey(location);
  useEffect(() => {
    if (!projectId) return;
    const root = document.querySelector(".app-shell");
    if (!root) return;
    const saved = pending.current;
    pending.current = null;
    const restore =
      saved?.projectId === projectId && locationKey(saved) === key
        ? saved.scroll
        : {};
    let restoring = Object.keys(restore).length > 0;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const positions: Record<string, ScrollPosition> = { ...restore };
    const persist = () => {
      if (restoring || disposed) return;
      for (const [name, pane] of panes())
        positions[name] = { top: pane.scrollTop, left: pane.scrollLeft };
      try {
        sessionStorage.setItem(
          resumeKey,
          JSON.stringify({ ...location, projectId, scroll: positions }),
        );
      } catch {
        /* Storage may be unavailable; navigation stays usable. */
      }
    };
    const finish = () => {
      if (!restoring) return;
      restoring = false;
      observer.disconnect();
      resize.disconnect();
      if (timer) clearTimeout(timer);
      persist();
    };
    const attempt = () => {
      frame = 0;
      if (!restoring || disposed) return;
      let complete = true;
      const current = panes();
      for (const [name, position] of Object.entries(restore)) {
        const pane = current.get(name);
        if (!pane) {
          if (position.top || position.left) complete = false;
          continue;
        }
        resize.observe(pane);
        pane.scrollTop = position.top;
        pane.scrollLeft = position.left;
        if (
          Math.abs(pane.scrollTop - position.top) > 1 ||
          Math.abs(pane.scrollLeft - position.left) > 1
        )
          complete = false;
      }
      if (complete) finish();
    };
    const schedule = () => {
      if (!disposed && !frame && restoring)
        frame = requestAnimationFrame(attempt);
    };
    const observer = new MutationObserver(schedule);
    const resize = new ResizeObserver(schedule);
    const onScroll = () => persist();
    const userIntent = () => finish();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("pagehide", persist);
    // Stop restoring on an explicit user action, including scrollbar dragging and keyboard scrolling.
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
      document.addEventListener(event, userIntent, {
        capture: true,
        passive: true,
      });
    if (restoring) {
      observer.observe(root, { childList: true, subtree: true });
      resize.observe(root);
      schedule();
      void document.fonts.ready.then(schedule);
      // If content has shrunk, keep the nearest valid position rather than retry indefinitely.
      timer = setTimeout(() => {
        attempt();
        finish();
      }, 3000);
    } else persist();
    return () => {
      disposed = true;
      if (restoring) pending.current = saved;
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pagehide", persist);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
        document.removeEventListener(event, userIntent, true);
    };
  }, [projectId, key]);
}
