import { tool } from "@openai/agents";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const GenerateShoppingListParameters = z.object({
  planMarkdown: z.string().min(1).describe("Полный одобренный план в Markdown, из которого нужно извлечь продукты."),
}).strict();

const PRODUCT_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/овсян/iu, "овсяные хлопья"], [/банан/iu, "бананы"], [/яблок/iu, "яблоки"],
  [/груш/iu, "груши"], [/яйц/iu, "яйца"], [/цельнозернов/iu, "цельнозерновой хлеб"],
  [/греч/iu, "гречка"], [/\bрис/iu, "рис"], [/макарон|паст/iu, "макароны"],
  [/картоф/iu, "картофель"], [/куриц|курин/iu, "курица"], [/индей/iu, "индейка"],
  [/рыб|лосос|треск/iu, "рыба"], [/тунец/iu, "тунец"], [/тофу/iu, "тофу"],
  [/чечевиц/iu, "чечевица"], [/нут/iu, "нут"], [/фасол/iu, "фасоль"],
  [/овощ|помидор|томат|огур|перец|брокколи|морков/iu, "овощи"],
  [/салат|зелень/iu, "салатная зелень"], [/орех/iu, "орехи"],
  [/растительн.{0,8}(молок|напит)/iu, "растительный напиток"],
  [/безлактозн/iu, "безлактозные продукты"], [/йогурт/iu, "безлактозный йогурт"],
  [/оливков.{0,8}масл/iu, "оливковое масло"], [/ягод/iu, "ягоды"],
];

export async function generateShoppingList(planMarkdown: string): Promise<{ ok: true; items: string[] }> {
  const items = PRODUCT_PATTERNS
    .filter(([pattern]) => pattern.test(planMarkdown))
    .map(([, product]) => product);
  const uniqueItems = [...new Set(items)];
  const markdown = ["# Список покупок", "", ...(uniqueItems.length
    ? uniqueItems.map((item) => `- ${item}`)
    : ["- Конкретные продукты в плане не распознаны — проверьте план вручную."])]
    .join("\n");
  await writeFile(join(process.cwd(), "data", "shopping.md"), `${markdown}\n`, "utf8");
  return { ok: true, items: uniqueItems };
}

export const generateShoppingListTool = tool({
  name: "generateShoppingList",
  description: "Создать data/shopping.md со списком продуктов, упомянутых в одобренном плане. Вызывай после одобрения плана только когда пользователь просит список покупок или явно хочет подготовить продукты для плана. Передавай весь финальный план, а не пересказ.",
  parameters: GenerateShoppingListParameters,
  execute: ({ planMarkdown }) => generateShoppingList(planMarkdown),
});
