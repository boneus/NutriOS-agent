import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import { readFile, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { z } from "zod";

const COACH_PROMPT = `
Ты Health Coach Agent. Составляй персональные рекомендации только по питанию,
тренировкам, восстановлению и полезным привычкам на основе задачи, профиля и дневника.
Не ставь диагнозы, не назначай лечение, лекарства или дозировки. Для медицинских
вопросов кратко рекомендуй обратиться к подходящему квалифицированному специалисту.

Формат ответа в Markdown:
# План
## Цель и логика
## Питание
## Активность
## Восстановление и привычки
## Что отслеживать
Давай конкретные, реалистичные действия, количества и время там, где это уместно.
`;

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

const ReviewSchema = z.object({
  verdict: z.enum(["approve", "revise", "needs_human_professional"]),
  score: z.number().int().min(0).max(10),
  issues: z.array(z.string()),
}).strict();

type Review = z.infer<typeof ReviewSchema>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`В .env не задана переменная ${name}`);
  return value;
}

function parseReview(raw: string): Review {
  const json = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return ReviewSchema.parse(JSON.parse(json));
}

async function main() {
  // Загружаем настройки провайдера и входные данные.
  try {
    loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const task = process.argv.slice(2).join(" ").trim();
  if (!task) throw new Error('Использование: npx tsx index.ts "задача"');

  const [profile, log] = await Promise.all([
    readFile("profile.md", "utf8"),
    readFile("log.md", "utf8"),
  ]);

  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const provider = new OpenAIProvider({
    apiKey: requiredEnv("DEEPSEEK_API_KEY"),
    baseURL: requiredEnv("DEEPSEEK_BASE_URL"),
    useResponses: false,
  });
  const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
  const coach = new Agent({ name: "Health Coach", instructions: COACH_PROMPT, model });
  const reviewer = new Agent({ name: "Safety Reviewer", instructions: REVIEWER_PROMPT, model });

  const reviewPlan = async (plan: string): Promise<Review> => {
    const input = `Задача пользователя:\n${task}\n\nПрофиль:\n${profile}\n\nПлан:\n${plan}`;
    let lastError: unknown;

    // При невалидном JSON повторяем запрос reviewer-а ровно один раз.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await runner.run(reviewer, input);
      try {
        if (typeof result.finalOutput !== "string") throw new Error("Пустой ответ reviewer-а");
        return parseReview(result.finalOutput);
      } catch (error) {
        lastError = error;
        if (attempt === 1) console.warn("Reviewer вернул невалидный JSON, повторяю запрос...");
      }
    }
    throw new Error(`Reviewer дважды вернул невалидный JSON: ${String(lastError)}`);
  };

  let draft = "";
  let issues: string[] = [];
  for (let round = 1; round <= 3; round++) {
    // Коуч каждый раз возвращает полный обновлённый план.
    const coachInput = `Задача:\n${task}\n\nПрофиль:\n${profile}\n\nДневник:\n${log}` +
      (draft ? `\n\nПредыдущий план:\n${draft}\n\nИсправь его по замечаниям reviewer-а:\n- ${issues.join("\n- ")}` : "");
    const result = await runner.run(coach, coachInput);
    if (typeof result.finalOutput !== "string") throw new Error("Коуч не вернул план");

    draft = result.finalOutput.trim();
    const review = await reviewPlan(draft);
    console.log(`Раунд ${round}: verdict=${review.verdict}, score=${review.score}, issues=${JSON.stringify(review.issues)}`);

    if (review.verdict === "needs_human_professional") {
      console.log("Запрос требует консультации квалифицированного специалиста. План не сохранён.");
      return;
    }
    if (review.verdict === "approve") {
      await writeFile("output.md", `${draft}\n`, "utf8");
      console.log(`План сохранён в output.md. Итоговая оценка: ${review.score}/10`);
      return;
    }
    issues = review.issues;
  }

  throw new Error("План не одобрен после трёх раундов ревизии");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
