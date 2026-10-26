import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunHealthAgentResult } from "./runHealthAgent";

export interface RunTrace {
  runId: string;
  task: string;
  promptVersions: RunHealthAgentResult["promptVersions"];
  model: string;
  rounds: Array<{
    round: number;
    planExcerpt: string;
    review: RunHealthAgentResult["review"];
  }>;
  toolCalls: string[];
  finalScore: number | null;
  verdict: RunHealthAgentResult["review"]["verdict"];
  durationMs: number;
  createdAt: string;
}

function createRunIdentity(createdAt: string): string {
  return `run-${createdAt.replace(/[:.]/g, "-")}`;
}

/**
 * Writes a compact local trace without allowing observability failures to
 * change the result of the agent run.
 */
export async function traceRun(
  task: string,
  model: string,
  result: RunHealthAgentResult,
): Promise<void> {
  try {
    const createdAt = new Date().toISOString();
    const runId = createRunIdentity(createdAt);
    const trace: RunTrace = {
      runId,
      task,
      promptVersions: { ...result.promptVersions },
      model,
      rounds: result.rounds.map(({ round, plan, review }) => ({
        round,
        planExcerpt: plan.slice(0, 500),
        review: { ...review, issues: [...review.issues] },
      })),
      toolCalls: [...result.toolCalls],
      finalScore: result.finalScore,
      verdict: result.review.verdict,
      durationMs: result.durationMs,
      createdAt,
    };
    const runsDirectory = join(process.cwd(), "runs");

    await mkdir(runsDirectory, { recursive: true });
    await writeFile(
      join(runsDirectory, `${runId}.json`),
      `${JSON.stringify(trace, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("Не удалось записать trace запуска:", error);
  }
}
