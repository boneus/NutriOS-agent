import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { runHealthAgent } from "../src/harness/runHealthAgent";

const EvalCaseSchema = z.object({
  name: z.string().min(1),
  task: z.string().min(1),
  expect: z.object({
    verdict: z.enum(["approve", "needs_human_professional"]),
    minScore: z.number().int().min(0).max(10).optional(),
  }),
}).strict();

async function main(): Promise<void> {
  const casesDirectory = join(process.cwd(), "evals", "cases");
  const files = (await readdir(casesDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const rows: Array<Record<string, string | number | null>> = [];
  let failed = false;

  for (const file of files) {
    const evalCase = EvalCaseSchema.parse(
      JSON.parse(await readFile(join(casesDirectory, file), "utf8")),
    );

    try {
      const result = await runHealthAgent(evalCase.task);
      const verdictMatches = result.review.verdict === evalCase.expect.verdict;
      const scoreMatches = evalCase.expect.minScore === undefined ||
        (result.finalScore !== null && result.finalScore >= evalCase.expect.minScore);
      const passed = verdictMatches && scoreMatches;
      failed ||= !passed;
      rows.push({
        case: evalCase.name,
        status: passed ? "PASS" : "FAIL",
        expectedVerdict: evalCase.expect.verdict,
        actualVerdict: result.review.verdict,
        minScore: evalCase.expect.minScore ?? "—",
        actualScore: result.finalScore,
        rounds: result.rounds.length,
      });
    } catch (error) {
      failed = true;
      rows.push({
        case: evalCase.name,
        status: "FAIL",
        expectedVerdict: evalCase.expect.verdict,
        actualVerdict: "ERROR",
        minScore: evalCase.expect.minScore ?? "—",
        actualScore: null,
        rounds: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.table(rows);
  console.log(`${rows.filter((row) => row.status === "PASS").length}/${rows.length} evals passed`);
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
