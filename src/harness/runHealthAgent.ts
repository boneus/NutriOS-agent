import { OpenAIProvider, Runner } from "@openai/agents";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { createHealthCoach } from "../agents/healthCoach";
import { createSafetyReviewer } from "../agents/safetyReviewer";
import { loadActivePrompts, type PromptVersions } from "./promptVersions";
import { RoundHistory, type RoundState } from "./rounds";
import { calculateScore } from "./score";
import { validateReview, type Review } from "./validateReview";

export interface RunHealthAgentResult {
  plan: string;
  review: Review;
  rounds: RoundState[];
  finalScore: number | null;
  promptVersions: PromptVersions;
  durationMs: number;
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

export async function runHealthAgent(
  task: string,
  maxRounds = 3,
): Promise<RunHealthAgentResult> {
  const normalizedTask = task.trim();
  if (!normalizedTask) throw new Error("Задача не должна быть пустой");
  if (!Number.isInteger(maxRounds) || maxRounds <= 0) {
    throw new Error("maxRounds должен быть положительным целым числом");
  }

  const startedAt = Date.now();
  loadLocalEnv();
  const dataDirectory = join(process.cwd(), "data");
  const [profile, log, activePrompts] = await Promise.all([
    readFile(join(dataDirectory, "profile.md"), "utf8"),
    readFile(join(dataDirectory, "log.md"), "utf8"),
    loadActivePrompts(),
  ]);

  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const provider = new OpenAIProvider({
    apiKey: requiredEnv("DEEPSEEK_API_KEY"),
    baseURL: requiredEnv("DEEPSEEK_BASE_URL"),
    useResponses: false,
  });
  const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
  const coach = createHealthCoach(model, activePrompts.coach);
  const reviewer = createSafetyReviewer(model, activePrompts.reviewer);
  const history = new RoundHistory();

  const reviewPlan = (plan: string): Promise<Review> => {
    const input = `Задача пользователя:\n${normalizedTask}\n\nПрофиль:\n${profile}\n\nПлан:\n${plan}`;
    return validateReview(async () => {
      const result = await runner.run(reviewer, input);
      return result.finalOutput;
    });
  };

  const buildResult = (plan: string, review: Review): RunHealthAgentResult => {
    const rounds = history.all();
    const { finalScore } = calculateScore(rounds);

    return {
      plan,
      review,
      rounds,
      finalScore,
      promptVersions: { ...activePrompts.versions },
      durationMs: Date.now() - startedAt,
    };
  };

  let draft = "";
  let issues: string[] = [];
  for (let round = 1; round <= maxRounds; round++) {
    const coachInput = `Задача:\n${normalizedTask}\n\nПрофиль:\n${profile}\n\nДневник:\n${log}` +
      (draft ? `\n\nПредыдущий план:\n${draft}\n\nИсправь его по замечаниям reviewer-а:\n- ${issues.join("\n- ")}` : "");
    const result = await runner.run(coach, coachInput);
    if (typeof result.finalOutput !== "string") throw new Error("Коуч не вернул план");

    draft = result.finalOutput.trim();
    const review = await reviewPlan(draft);
    history.add({ round, plan: draft, review });

    if (review.verdict === "needs_human_professional") {
      return buildResult(draft, review);
    }
    if (review.verdict === "approve") {
      await writeFile(join(dataDirectory, "output.md"), `${draft}\n`, "utf8");
      return buildResult(draft, review);
    }
    issues = review.issues;
  }

  if (maxRounds === 3) {
    throw new Error("План не одобрен после трёх раундов ревизии");
  }
  throw new Error(`План не одобрен после ${maxRounds} раундов ревизии`);
}
