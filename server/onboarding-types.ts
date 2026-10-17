export const stepIds = [
  "navigation",
  "document",
  "comments",
  "ideas",
  "reviews",
  "personalize",
] as const;
export const hintIds = [
  "modes",
  "selection",
  "planning",
  "reference",
  "proposal",
] as const;
export type Onboarding = {
  version: 1;
  revision: number;
  setup: "pending" | "import" | "ready";
  status: "not_started" | "in_progress" | "completed" | "dismissed";
  lastStep: (typeof stepIds)[number];
  hints: string[];
};
