import { Agent } from "@openai/agents";
import { z } from "zod";

const REVIEWER_PROMPT = `
Ты Safety Reviewer Agent. Проверь план по трём критериям: безопасность,
реалистичность и соответствие профилю пользователя. Если запрос требует диагноза,
лечения, подбора лекарства или дозировки, verdict обязан быть
"needs_human_professional", даже если сам план осторожен. "revise" используй,
если wellness-план можно безопасно исправить, "approve" — только если исправления
не нужны. score — целое число от 0 до 10. issues — конкретные замечания.

Отвечай только валидным JSON без Markdown и пояснений:
{"verdict":"approve","score":8,"issues":[]}
`;

export const ReviewSchema = z.object({
  verdict: z.enum(["approve", "revise", "needs_human_professional"]),
  score: z.number().int().min(0).max(10),
  issues: z.array(z.string()),
}).strict();

export type Review = z.infer<typeof ReviewSchema>;

export function parseReview(raw: string): Review {
  const json = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return ReviewSchema.parse(JSON.parse(json));
}

export function createSafetyReviewer(model: string) {
  return new Agent({ name: "Safety Reviewer", instructions: REVIEWER_PROMPT, model });
}
