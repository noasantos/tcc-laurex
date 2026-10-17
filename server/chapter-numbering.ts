import type { Chapter, State } from "./types";
export const maximumChapterNumber = 9999;
export function chapterNumber(
  chapter: Pick<Chapter, "id" | "number">,
  chapters: Pick<Chapter, "id">[],
) {
  return chapter.number ?? chapters.findIndex((c) => c.id === chapter.id) + 1;
}
/** Only the ordinal previously used by this app is migrated. Numeric academic titles stay intact. */
export function legacyChapterTitle(title: string, index: number) {
  const prefix = `${index + 1}. `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}
export function synchronizeChapterNumbers(state: State, before: State) {
  const used = new Set(
    state.chapters.flatMap((c) => (c.number === undefined ? [] : [c.number])),
  );
  let next = Math.max(0, ...used) + 1;
  for (const [index, c] of state.chapters.entries()) {
    if (c.number === undefined) {
      c.number = next++;
      c.title = legacyChapterTitle(c.title, index);
    }
    if (
      !Number.isInteger(c.number) ||
      c.number < 1 ||
      c.number > maximumChapterNumber
    )
      throw new Error("Número de capítulo inválido (1 a 9999).");
  }
  if (
    new Set(state.chapters.map((c) => c.number)).size !== state.chapters.length
  )
    throw new Error("Números de capítulo repetidos.");
  state.chapters.sort((a, b) => a.number! - b.number!);
  for (const c of state.chapters) {
    const old = before.chapters.find((x) => x.id === c.id);
    if (
      old &&
      c.revision === old.revision &&
      (old.number !== c.number || old.title !== c.title)
    )
      c.revision++;
  }
}
export function previewChapterPlacement(
  chapters: { id: string; title: string; number?: number }[],
  draft: { id: string; title: string; number?: number },
  number: number,
) {
  const rows = chapters
    .filter((c) => c.id !== draft.id)
    .map((c, index) => ({ ...c, number: c.number ?? index + 1 }));
  let free = number;
  const occupied = new Set(rows.map((c) => c.number));
  while (occupied.has(free)) free++;
  for (const row of rows)
    if (row.number >= number && row.number < free) row.number++;
  return [...rows, { ...draft, number }].sort((a, b) => a.number! - b.number!);
}
export function placeChapter(
  chapters: Chapter[],
  draft: Chapter,
  number: number,
) {
  const preview = previewChapterPlacement(chapters, draft, number);
  if (preview.some((c) => c.number! > maximumChapterNumber))
    throw new Error("Não há espaço nesta numeração. Escolha outro número.");
  return preview.map((row) => {
    const c = chapters.find((x) => x.id === row.id) ?? draft;
    c.number = row.number;
    return c;
  });
}
