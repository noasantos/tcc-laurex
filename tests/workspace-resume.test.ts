import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseWorkspaceResume,
  resolveWorkspaceResume,
  locationKey,
} from "../src/workspace-resume";
const saved = {
  projectId: "project",
  page: "document",
  chapterId: "intro",
  commentPanel: true,
  commentId: "comment",
  settingsTab: "general",
  comparisonId: "proposal",
  scroll: { ".document-body:0": { top: 723, left: 0 } },
};
const project = {
  id: "project",
  chapters: [{ id: "intro" }],
  comments: [{ id: "comment" }],
  proposals: [{ id: "proposal" }],
};
test("restores exact chapter, contextual review and pixel scroll positions", () => {
  const parsed = parseWorkspaceResume(JSON.stringify(saved));
  assert.deepEqual(resolveWorkspaceResume(parsed, project), saved);
  assert.equal(locationKey(parsed!), locationKey(saved));
});
test("rejects corrupt storage, unknown pages and invalid scroll offsets", () => {
  assert.equal(parseWorkspaceResume("not json"), null);
  assert.equal(
    parseWorkspaceResume(JSON.stringify({ ...saved, page: "unknown" })),
    null,
  );
  assert.deepEqual(
    parseWorkspaceResume(
      JSON.stringify({
        ...saved,
        scroll: {
          bad: { top: -1, left: 0 },
          valid: { top: 0, left: 10 },
          missing: { top: 2 },
        },
      }),
    )?.scroll,
    { valid: { top: 0, left: 10 } },
  );
});
test("does not restore another project or a removed chapter", () => {
  assert.equal(
    resolveWorkspaceResume(saved, { ...project, id: "other" }),
    null,
  );
  assert.equal(
    resolveWorkspaceResume(saved, { ...project, chapters: [] }),
    null,
  );
});
test("keeps collection pages and drops unavailable comment/proposal targets", () => {
  assert.deepEqual(
    resolveWorkspaceResume(
      { ...saved, page: "references" },
      { ...project, chapters: [], comments: [], proposals: [] },
    ),
    { ...saved, page: "references", commentId: "", comparisonId: "" },
  );
});
