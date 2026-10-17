import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCommentAnchorVisible as visible,
  type ReadingRect,
} from "../src/components/comment-visibility";
const pane = { top: 100, bottom: 500, left: 200, right: 800 };
const line = (top: number, bottom = top + 20): ReadingRect => ({
  top,
  bottom,
  left: 220,
  right: 700,
});
test("short excerpt is disabled only when all wrapped lines and paragraphs are readable", () => {
  assert.equal(visible([line(120), line(150), line(240)], pane), true);
  assert.equal(visible([line(90), line(150)], pane), false);
  assert.equal(visible([line(480), line(510)], pane), false);
  assert.equal(visible([line(102)], pane), true);
});
test("long excerpt requires its beginning in the upper half, not an arbitrary middle fragment", () => {
  assert.equal(visible([line(150), line(600)], pane), true);
  assert.equal(visible([line(50), line(450), line(800)], pane), false);
  assert.equal(visible([line(400), line(900)], pane), false);
});
test("hidden, missing, horizontally clipped and collapsed reading areas cannot disable navigation", () => {
  assert.equal(visible([], pane), false);
  assert.equal(
    visible([{ top: 0, bottom: 0, left: 0, right: 0 }], pane),
    false,
  );
  assert.equal(visible([{ ...line(130), right: 850 }], pane), false);
  assert.equal(visible([line(130)], { ...pane, bottom: 100 }), false);
});
