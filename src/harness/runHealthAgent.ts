import { OpenAIProvider, Runner } from "@openai/agents";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { createHealthCoach } from "../agents/healthCoach";
import {
  createSafetyReviewer,
  parseReview,
  type Review,
} from "../agents/safetyReviewer";

export interface RunHealthAgentResult {
  plan: string;
  review: Review;
  rounds: number;
}

function loadLocalEnv(): void {
  try {
    loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`В .env не задана переменная ${name}`);
  return value;
}

export async function runHealthAgent(task: string): Promise<RunHealthAgentResult> {
  const normalizedTask = task.trim();
  if (!normalizedTask) throw new Error("Задача не должна быть пустой");

  loadLocalEnv();
  const dataDirectory = join(process.cwd(), "data");
  const [profile, log] = await Promise.all([
    readFile(join(dataDirectory, "profile.md"), "utf8"),
    readFile(join(dataDirectory, "log.md"), "utf8"),
  ]);

  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const provider = new OpenAIProvider({
    apiKey: requiredEnv("DEEPSEEK_API_KEY"),
    baseURL: requiredEnv("DEEPSEEK_BASE_URL"),
    useResponses: false,
  });
  const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
  const coach = createHealthCoach(model);
  const reviewer = createSafetyReviewer(model);

  const reviewPlan = async (plan: string): Promise<Review> => {
    const input = `Задача пользователя:\n${normalizedTask}\n\nПрофиль:\n${profile}\n\nПлан:\n${plan}`;
    let lastError: unknown;

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
    const coachInput = `Задача:\n${normalizedTask}\n\nПрофиль:\n${profile}\n\nДневник:\n${log}` +
      (draft ? `\n\nПредыдущий план:\n${draft}\n\nИсправь его по замечаниям reviewer-а:\n- ${issues.join("\n- ")}` : "");
    const result = await runner.run(coach, coachInput);
    if (typeof result.finalOutput !== "string") throw new Error("Коуч не вернул план");

    draft = result.finalOutput.trim();
    const review = await reviewPlan(draft);
    const agentResult = { plan: draft, review, rounds: round };

    if (review.verdict === "needs_human_professional") return agentResult;
    if (review.verdict === "approve") {
      await writeFile(join(dataDirectory, "output.md"), `${draft}\n`, "utf8");
      return agentResult;
    }
    issues = review.issues;
  }

  throw new Error("План не одобрен после трёх раундов ревизии");
}
