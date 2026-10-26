import { tool } from "@openai/agents";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const GetRecentLogParameters = z.object({
  days: z.number().int().min(1).max(30).describe("Количество последних дневных записей, которые нужны для ответа: от 1 до 30."),
}).strict();

export async function getRecentLog(days: number): Promise<string> {
  const log = await readFile(join(process.cwd(), "data", "log.md"), "utf8");
  const entries = log.split(/(?=^##\s+)/m).filter((part) => part.trimStart().startsWith("## "));
  return entries.slice(-days).join("\n").trim();
}

export const getRecentLogTool = tool({
  name: "getRecentLog",
  description: "Получить последние N дневных записей пользователя в хронологическом порядке. Записи содержат сон, питание, активность и самочувствие. Используй, когда пользователь ссылается на свой лог/дневник, просит учесть недавнее состояние или когда для плана важны последние привычки. Выбирай минимальное достаточное число дней.",
  parameters: GetRecentLogParameters,
  execute: ({ days }) => getRecentLog(days),
});
