import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const ACTIVE_PROMPTS = {
  coach: "v1",
  reviewer: "v1",
} as const;

export interface PromptVersions {
  coach: string;
  reviewer: string;
}

export interface ActivePrompts {
  coach: string;
  reviewer: string;
  versions: PromptVersions;
}

type PromptName = keyof typeof ACTIVE_PROMPTS;

const PROMPT_FILES: Record<PromptName, string> = {
  coach: "healthCoach",
  reviewer: "safetyReviewer",
};

export function loadPrompt(name: PromptName, version: string): Promise<string> {
  const path = join(process.cwd(), "prompts", `${PROMPT_FILES[name]}.${version}.md`);
  return readFile(path, "utf8");
}

export async function loadActivePrompts(): Promise<ActivePrompts> {
  const [coach, reviewer] = await Promise.all([
    loadPrompt("coach", ACTIVE_PROMPTS.coach),
    loadPrompt("reviewer", ACTIVE_PROMPTS.reviewer),
  ]);

  return {
    coach,
    reviewer,
    versions: { ...ACTIVE_PROMPTS },
  };
}
