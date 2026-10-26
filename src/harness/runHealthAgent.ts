import { OpenAIProvider, Runner, type RunItem } from "@openai/agents";
import { loadEnvFile } from "node:process";
import { createHealthCoach } from "../agents/healthCoach";
import { createSafetyReviewer } from "../agents/safetyReviewer";
import { savePlanTool } from "../skills/plans";
import { generateShoppingListTool } from "../skills/shopping";
import { loadActivePrompts, type PromptVersions } from "./promptVersions";
import { RoundHistory, type RoundState } from "./rounds";
import { calculateScore } from "./score";
import { traceRun } from "./traceRun";
import { validateReview, type Review } from "./validateReview";

export interface RunHealthAgentResult {
  plan: string;
  review: Review;
  rounds: RoundState[];
  finalScore: number | null;
  promptVersions: PromptVersions;
  toolCalls: string[];
  toolCallDetails: ToolCallDetails[];
  durationMs: number;
}

export interface ToolCallDetails {
  name: string;
  parameters: unknown;
}

function parseToolParameters(rawParameters: string): unknown {
  try {
    return JSON.parse(rawParameters) as unknown;
  } catch {
    return rawParameters;
  }
}

function collectToolCalls(result: { newItems: RunItem[] }): ToolCallDetails[] {
  return result.newItems.flatMap((item) => {
    if (item.type !== "tool_call_item" || item.rawItem.type !== "function_call") return [];
    return [{
      name: item.rawItem.name,
      parameters: parseToolParameters(item.rawItem.arguments),
    }];
  });
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
  if (!Number.isInteger(maxRounds) || maxRounds <= 0 || maxRounds > 3) {
    throw new Error("maxRounds должен быть целым числом от 1 до 3");
  }

  const startedAt = Date.now();
  loadLocalEnv();
  const activePrompts = await loadActivePrompts();

  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const provider = new OpenAIProvider({
    apiKey: requiredEnv("DEEPSEEK_API_KEY"),
    baseURL: requiredEnv("DEEPSEEK_BASE_URL"),
    useResponses: false,
  });
  const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
  const coach = createHealthCoach(model, activePrompts.coach);
  const finalizer = createHealthCoach(model, activePrompts.coach, [savePlanTool, generateShoppingListTool]);
  const reviewer = createSafetyReviewer(model, activePrompts.reviewer);
  const history = new RoundHistory();
  const toolCallDetails: ToolCallDetails[] = [];

  const reviewPlan = (plan: string): Promise<Review> => {
    return validateReview(async () => {
      // Reviewer receives the task and proposed plan but has no tools, so it
      // cannot read user files or cause side effects.
      const result = await runner.run(
        reviewer,
        `Исходная задача пользователя:\n${normalizedTask}\n\nПредложенный план:\n${plan}`,
      );
      return result.finalOutput;
    });
  };

  const buildResult = async (plan: string, review: Review): Promise<RunHealthAgentResult> => {
    const rounds = history.all();
    const { finalScore } = calculateScore(rounds);

    const result: RunHealthAgentResult = {
      plan,
      review,
      rounds,
      finalScore,
      promptVersions: { ...activePrompts.versions },
      toolCalls: toolCallDetails.map(({ name }) => name),
      toolCallDetails: toolCallDetails.map(({ name, parameters }) => ({ name, parameters })),
      durationMs: Date.now() - startedAt,
    };

    await traceRun(normalizedTask, model, result);
    return result;
  };

  let draft = "";
  let issues: string[] = [];
  for (let round = 1; round <= maxRounds; round++) {
    const coachInput = `Задача:\n${normalizedTask}` +
      (draft ? `\n\nПредыдущий план:\n${draft}\n\nИсправь его по замечаниям reviewer-а:\n- ${issues.join("\n- ")}` : "");
    const result = await runner.run(coach, coachInput);
    toolCallDetails.push(...collectToolCalls(result));
    if (typeof result.finalOutput !== "string") throw new Error("Коуч не вернул план");

    draft = result.finalOutput.trim();
    const review = await reviewPlan(draft);
    history.add({ round, plan: draft, review });

    if (review.verdict === "needs_human_professional") {
      return await buildResult(draft, review);
    }
    if (review.verdict === "approve") {
      // Side-effect tools are unavailable while drafting. The harness exposes
      // them only after approval, because a prompt instruction alone cannot
      // enforce the persistence safety boundary.
      const finalization = await runner.run(finalizer,
        `План уже одобрен Safety Reviewer. Обязательно вызови savePlan ровно один раз, передав план без изменений. ` +
        `Если исходная задача просит список покупок, также вызови generateShoppingList; иначе не вызывай его.\n\n` +
        `Исходная задача:\n${normalizedTask}\n\nОдобренный план:\n${draft}`,
        { maxTurns: 4 },
      );
      const finalizationToolCalls = collectToolCalls(finalization);
      toolCallDetails.push(...finalizationToolCalls);
      if (!finalizationToolCalls.some(({ name }) => name === "savePlan")) {
        throw new Error("Коуч не сохранил одобренный план");
      }
      return await buildResult(draft, review);
    }
    issues = review.issues;
  }

  if (maxRounds === 3) {
    throw new Error("План не одобрен после трёх раундов ревизии");
  }
  throw new Error(`План не одобрен после ${maxRounds} раундов ревизии`);
}
