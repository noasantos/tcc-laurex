export const resumeKey = "laura-workspace-resume-v1";
export const workspacePages = [
  "overview",
  "document",
  "notes",
  "comments",
  "history",
  "references",
  "settings",
  "proposals",
  "new-chapter",
] as const;
export type WorkspacePage = (typeof workspacePages)[number];
export type WorkspaceLocation = {
  page: string;
  chapterId: string;
  commentPanel: boolean;
  commentId: string;
  settingsTab: string;
  comparisonId: string;
};
export type ScrollPosition = { top: number; left: number };
export type WorkspaceResume = WorkspaceLocation & {
  projectId: string;
  scroll: Record<string, ScrollPosition>;
};
export function parseWorkspaceResume(
  value: string | null,
): WorkspaceResume | null {
  try {
    const data = JSON.parse(value || "null");
    if (
      !data ||
      typeof data.projectId !== "string" ||
      !workspacePages.includes(data.page)
    )
      return null;
    const scroll: Record<string, ScrollPosition> = {};
    for (const [key, position] of Object.entries(data.scroll || {})) {
      const p = position as ScrollPosition;
      if (
        p &&
        Number.isFinite(p.top) &&
        Number.isFinite(p.left) &&
        p.top >= 0 &&
        p.left >= 0
      )
        scroll[key] = { top: p.top, left: p.left };
    }
    return {
      projectId: data.projectId,
      page: data.page,
      chapterId: typeof data.chapterId === "string" ? data.chapterId : "",
      commentId: typeof data.commentId === "string" ? data.commentId : "",
      commentPanel: data.commentPanel === true,
      settingsTab:
        typeof data.settingsTab === "string" ? data.settingsTab : "general",
      comparisonId:
        typeof data.comparisonId === "string" ? data.comparisonId : "",
      scroll,
    };
  } catch {
    return null;
  }
}
export function readWorkspaceResume() {
  try {
    return parseWorkspaceResume(sessionStorage.getItem(resumeKey));
  } catch {
    return null;
  }
}
export function resolveWorkspaceResume(
  saved: WorkspaceResume | null,
  project: {
    id: string;
    chapters: { id: string }[];
    comments: { id: string }[];
    proposals: { id: string }[];
  },
): WorkspaceResume | null {
  if (!saved || saved.projectId !== project.id) return null;
  if (
    saved.page === "document" &&
    !project.chapters.some((c) => c.id === saved.chapterId)
  )
    return null;
  return {
    ...saved,
    commentId: project.comments.some((c) => c.id === saved.commentId)
      ? saved.commentId
      : "",
    comparisonId: project.proposals.some((p) => p.id === saved.comparisonId)
      ? saved.comparisonId
      : "",
  };
}
export function locationKey(location: WorkspaceLocation) {
  return JSON.stringify([
    location.page,
    location.page === "document" ? location.chapterId : "",
    location.commentPanel,
    location.commentId,
    location.settingsTab,
    location.comparisonId,
  ]);
}
export function readSourceMode(
  chapterId: string,
): "visual" | "source" | "split" {
  try {
    const mode = sessionStorage.getItem("laura-source-mode-" + chapterId);
    return mode === "source" || mode === "split" ? mode : "visual";
  } catch {
    return "visual";
  }
}
