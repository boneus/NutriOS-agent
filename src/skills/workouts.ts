import { tool } from "@openai/agents";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const WorkoutGoalSchema = z.enum(["general_fitness", "strength", "mobility", "recovery"]);

const SuggestWorkoutTemplateParameters = z.object({
  goal: WorkoutGoalSchema
    .describe("Главная цель шаблона: общая форма, сила, мобильность или лёгкое восстановление."),
}).strict();

type WorkoutGoal = z.infer<typeof WorkoutGoalSchema>;

export async function suggestWorkoutTemplate(goal: WorkoutGoal): Promise<string> {
  const workouts = await readFile(join(process.cwd(), "data", "workouts.md"), "utf8");
  const section = workouts
    .split(/(?=^##\s+)/m)
    .find((part) => part.startsWith(`## ${goal}\n`));

  if (!section) throw new Error(`В data/workouts.md не найден шаблон ${goal}`);
  return section.replace(/^##\s+[^\n]+\n/, "").trim();
}

export const suggestWorkoutTemplateTool = tool({
  name: "suggestWorkoutTemplate",
  description: "Получить один безопасный базовый шаблон тренировки для выбранной цели. Используй как основу, когда запрос включает тренировку или активность; затем адаптируй объём под профиль и недавний лог. Не используй как медицинскую реабилитацию и не обещай лечебный эффект.",
  parameters: SuggestWorkoutTemplateParameters,
  execute: ({ goal }) => suggestWorkoutTemplate(goal),
});
