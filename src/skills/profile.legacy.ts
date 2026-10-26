import { tool } from "@openai/agents";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const GetProfileParameters = z.object({}).strict();

export function getProfile(): Promise<string> {
  return readFile(join(process.cwd(), "data", "profile.md"), "utf8");
}

export const getProfileTool = tool({
  name: "getProfile",
  description: "Прочитать постоянный профиль пользователя: цели, режим, пищевые ограничения и предпочтения, уровень подготовки, доступный инвентарь и известные сведения о здоровье. Вызывай перед персональными рекомендациями, если ответ может зависеть от индивидуальных особенностей. Не вызывай повторно в одном запуске без необходимости.",
  parameters: GetProfileParameters,
  execute: getProfile,
});
