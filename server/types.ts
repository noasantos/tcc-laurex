export type Doc = {
  type: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: { type: string; attrs?: Record<string, any> }[];
  content?: Doc[];
};
export type Chapter = {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  plan: string;
  content: Doc;
  /** Canonical academic source; content is its visual projection. */
  latex?: string;
  latexRevision?: number;
  latexWarnings?: string[];
  latexIssue?: string;
  revision: number;
};
export type Comment = {
  id: string;
  chapterId: string;
  body: string;
  quote: string;
  anchor: {
    blockIds?: string[];
    blockId?: string;
    prefix?: string;
    suffix?: string;
    scope?: string;
  };
  status: "open" | "resolved";
  author?: string;
  reviewState?: "open" | "analyzing" | "proposed" | "resolved" | "reopened";
  history?: {
    at: string;
    action: string;
    origin: string;
    version: number;
    proposalId?: string;
  }[];
  replies: { body: string; at: string; origin: string }[];
  createdAt: string;
  resolvedAt?: string;
};
export type Note = {
  id: string;
  title: string;
  content: string;
  category: string;
  chapterId: string | null;
  state: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
};
export type Reference = {
  id: string;
  key: string;
  title: string;
  authors: string;
  year: string;
  publication: string;
  doi: string;
  url: string;
  type: string;
  note: string;
  bibtex?: string;
  localPdfId?: string;
  verified?: boolean;
  origin?: string;
  createdAt?: string;
  updatedAt?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
};
export type Proposal = {
  id: string;
  chapterId: string;
  commentId?: string;
  baseChapterRevision: number;
  before: Doc;
  after: Doc;
  beforeLatex?: string;
  afterLatex?: string;
  reason: string;
  status: "pending" | "approved" | "applied" | "rejected" | "reverted";
  createdAt: string;
  appliedVersion?: number;
  operationId?: string;
  approvedAt?: string;
  appliedAt?: string;
  rejectedAt?: string;
};
export type State = {
  id: string;
  name: string;
  revision: number;
  chapters: Chapter[];
  comments: Comment[];
  notes: Note[];
  references: Reference[];
  proposals: Proposal[];
  settings: {
    mcpEnabled: boolean;
    mcpWrite: boolean;
    backupRetentionDays?: number;
  };
};
export const paragraph = (text: string): Doc => ({
  type: "paragraph",
  attrs: { id: crypto.randomUUID() },
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
export const emptyDoc = (): Doc => ({ type: "doc", content: [paragraph("")] });
export function plain(doc: Doc): string {
  return doc.type === "citation"
    ? String(doc.attrs?.label || doc.attrs?.key || "")
    : doc.type === "footnote"
      ? ""
      : doc.type === "crossReference"
        ? String(doc.attrs?.label || "")
        : doc.type === "inlineMath" || doc.type === "blockMath"
          ? String(doc.attrs?.latex || "")
          : (doc.text ??
            (doc.type === "rawLatex"
              ? String(doc.attrs?.source ?? "")
              : (doc.content ?? [])
                  .map(plain)
                  .join(
                    ["doc", "bulletList", "orderedList"].includes(doc.type)
                      ? "\n\n"
                      : "",
                  )));
}
