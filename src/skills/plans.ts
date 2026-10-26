import { tool } from "@openai/agents";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const SavePlanParameters = z.object({
  markdown: z.string().min(1).describe("Полный финальный wellness-план в Markdown без дополнительных пояснений вокруг него."),
}).strict();

export async function savePlan(markdown: string): Promise<{ ok: true }> {
  await writeFile(join(process.cwd(), "data", "output.md"), `${markdown.trim()}\n`, "utf8");
  return { ok: true };
}

export const savePlanTool = tool({
  name: "savePlan",
  description: "Сохранить одобренный Safety Reviewer финальный план в data/output.md. Этот tool изменяет файл и предназначен только для финальной фазы после явного разрешения harness. Передавай утверждённый план целиком и вызывай ровно один раз.",
  parameters: SavePlanParameters,
  execute: ({ markdown }) => savePlan(markdown),
});
