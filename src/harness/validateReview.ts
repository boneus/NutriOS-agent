import { z } from "zod";

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
  const parsed: unknown = JSON.parse(json);
  const result = ReviewSchema.safeParse(parsed);

  if (!result.success) throw result.error;
  return result.data;
}

export async function validateReview(
  requestReview: () => Promise<unknown>,
): Promise<Review> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const output = await requestReview();

    try {
      if (typeof output !== "string") throw new Error("Пустой ответ reviewer-а");
      return parseReview(output);
    } catch (error) {
      lastError = error;
      if (attempt === 1) console.warn("Reviewer вернул невалидный JSON, повторяю запрос...");
    }
  }

  throw new Error(`Reviewer дважды вернул невалидный JSON: ${String(lastError)}`);
}
