import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { runHealthAgent } from "../src/harness/runHealthAgent";

const ReplayTraceSchema = z.object({
  task: z.string().min(1),
  verdict: z.enum(["approve", "revise", "needs_human_professional"]),
  finalScore: z.number().nullable(),
  rounds: z.array(z.unknown()),
  toolCalls: z.array(z.string()),
  promptVersions: z.record(z.string(), z.string()),
});

function display(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function main(): Promise<void> {
  const tracePath = process.argv[2];
  if (!tracePath) {
    throw new Error("Укажите trace: npm run replay runs/run-XXX.json");
  }

  const absolutePath = resolve(process.cwd(), tracePath);
  const oldRun = ReplayTraceSchema.parse(JSON.parse(await readFile(absolutePath, "utf8")));
  const newRun = await runHealthAgent(oldRun.task);
  const comparison = [
    ["verdict", oldRun.verdict, newRun.review.verdict],
    ["score", oldRun.finalScore, newRun.finalScore],
    ["rounds", oldRun.rounds.length, newRun.rounds.length],
    ["toolCalls", oldRun.toolCalls, newRun.toolCalls],
    ["promptVersions", oldRun.promptVersions, newRun.promptVersions],
  ].map(([metric, oldValue, newValue]) => ({
    metric,
    old: display(oldValue),
    new: display(newValue),
    changed: display(oldValue) === display(newValue) ? "no" : "yes",
  }));

  console.log(`Replay задачи из ${tracePath}`);
  console.table(comparison);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
