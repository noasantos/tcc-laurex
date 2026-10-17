import { test } from "node:test";
import assert from "node:assert/strict";
import { commentPreview } from "../src/components/commentPreview";
test("prévias de comentários limitam texto sem cortar emojis nem alterar o original", () => {
  const original = "Uma dúvida 💡 sobre o capítulo";
  assert.deepEqual(commentPreview(original, 11), {
    text: "Uma dúvida…",
    truncated: true,
  });
  assert.deepEqual(commentPreview("💡💡💡", 2), {
    text: "💡💡…",
    truncated: true,
  });
  assert.deepEqual(commentPreview(original, 320), {
    text: original,
    truncated: false,
  });
});
