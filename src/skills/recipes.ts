import { tool } from "@openai/agents";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const ListFavoriteRecipesParameters = z.object({}).strict();

export function listFavoriteRecipes(): Promise<string> {
  return readFile(join(process.cwd(), "data", "recipes.md"), "utf8");
}

export const listFavoriteRecipesTool = tool({
  name: "listFavoriteRecipes",
  description: "Прочитать сохранённые любимые рецепты пользователя с ингредиентами. Используй, когда нужен конкретный рацион, меню или идеи блюд и предпочтительно опираться на уже знакомую пользователю еду. Для общих рекомендаций без меню вызов обычно не нужен.",
  parameters: ListFavoriteRecipesParameters,
  execute: listFavoriteRecipes,
});
