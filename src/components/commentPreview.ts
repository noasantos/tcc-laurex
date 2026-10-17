/** Preview limits count Unicode characters, preserving surrogate pairs. */
export function commentPreview(text: string, limit: number) {
  const characters = Array.from(text);
  return characters.length > limit
    ? {
        text: characters.slice(0, limit).join("").trimEnd() + "…",
        truncated: true,
      }
    : { text, truncated: false };
}
