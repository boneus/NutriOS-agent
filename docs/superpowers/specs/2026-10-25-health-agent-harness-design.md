# Health Agent Harness Design

## Intent

Turn `runHealthAgent` from a loop containing validation, state tracking, prompt text, scoring, and persistence concerns into a small orchestration layer around focused harness modules. Preserve the existing coach → safety-reviewer behavior and expose enough execution metadata for the UI to explain what happened.

## Goals

- Keep `runHealthAgent` as the public entry point while adding an optional `maxRounds` parameter with a default of `3`.
- Move reviewer validation and its single invalid-JSON retry into `validateReview.ts`.
- Represent every completed coach/reviewer cycle as `RoundState { round, plan, review }` and return the full ordered history.
- Compute the final approved score in `score.ts`; the internal score summary may include `improved`, but `improved` is not part of the public API or UI.
- Move the existing prompt text unchanged into versioned Markdown files and select versions through `ACTIVE_PROMPTS`.
- Return `plan`, `review`, `rounds`, `finalScore`, `promptVersions`, and `durationMs`.
- Show duration, active prompt versions, and a collapsed round history in the UI.

## Non-goals and anti-goals

- No tests, TDD, evals, replay support, database, trace persistence, or external service additions.
- No root CLI entry point.
- No changes to agent behavior or prompt wording beyond removing the TypeScript template-literal framing introduced by the old source representation.
- No disk writes except `data/output.md`, and only after an `approve` verdict.
- No generated plan may be shown for `needs_human_professional`.
- Do not turn the harness modules into a generic utility collection.

## Constraints and invariants

- This task intentionally supersedes the repository's older placement guidance in two places: versioned prompt files live in the repository-root `prompts/` directory, and the shared reviewer schema/parser move from `src/agents/safetyReviewer.ts` to `src/harness/validateReview.ts`.
- The harness runs from the repository root and resolves `data/*.md` and `prompts/*.md` from `process.cwd()`.
- There are at most `maxRounds` coach/reviewer rounds.
- Reviewer output gets exactly one retry after an invalid response, for at most two reviewer calls per round.
- `needs_human_professional` returns immediately without writing `output.md`.
- `approve` writes the plan to `output.md` and returns immediately.
- Exhausting all rounds without approval preserves the existing error behavior.
- An empty API task continues to return HTTP 400 without making a paid model request.

## Approaches considered

1. **Harness-owned prompt loading and dependency injection — selected.** `runHealthAgent` loads active prompt text and passes it into the existing agent factories. This keeps file/version policy in the harness while agent modules remain responsible only for constructing SDK agents.
2. **Agents load their own prompts.** This shortens the orchestrator but couples agent construction to filesystem access and makes active-version reporting less cohesive.
3. **`promptVersions.ts` also constructs agents.** This centralizes setup but mixes prompt storage with runtime object construction and weakens module boundaries.

## Module design

### `src/harness/promptVersions.ts`

- Exports `ACTIVE_PROMPTS = { coach: "v1", reviewer: "v1" }` as the single active-version switch.
- Defines the supported prompt names from the keys of `ACTIVE_PROMPTS`.
- Loads `prompts/<name>.<version>.md` as UTF-8 by explicit name and version.
- Resolves that path from the repository root (`process.cwd()`), not from `src/agents/`.
- Loads both active prompts in parallel and returns their text plus the exact version object returned to the client.
- Adding `prompts/healthCoach.v2.md` and changing the coach constant to `"v2"` requires no other code change.

### `src/harness/validateReview.ts`

- Owns and exports the strict Zod `ReviewSchema` and inferred `Review` type.
- Becomes the shared review contract imported by the orchestrator and, transitively through `RunHealthAgentResult`, by the UI; `safetyReviewer.ts` does not retain or re-export a second schema/parser.
- Parses raw model output after retaining the existing optional Markdown-fence cleanup.
- Uses safe parsing for the schema result.
- Exposes the reviewer execution boundary that calls the reviewer, retries once only when its output cannot be parsed/validated, and otherwise returns `Review`.
- Preserves the current reviewer input text and warning/error behavior.

### `src/harness/rounds.ts`

- Exports `RoundState` with `round`, `plan`, and `review`.
- Provides a small round-history abstraction responsible for appending completed rounds and returning ordered immutable snapshots.
- The orchestrator owns control flow; this module owns only round state/history.

### `src/harness/score.ts`

- Derives a score summary from completed rounds.
- `finalScore` is the score of the last `approve` review, or `null` when no round was approved.
- It may also derive the internal `improved` flag by comparing the last score with the first, but that flag is intentionally excluded from `RunHealthAgentResult` and the UI.

### `src/harness/runHealthAgent.ts`

- Keeps environment setup, input validation, profile/log loading, SDK provider/runner construction, orchestration, verdict handling, duration measurement, and the sole allowed write to `data/output.md`.
- Creates coach/reviewer agents with the loaded prompt strings.
- Delegates reviewer validation/retry, round history, score calculation, and prompt selection to their focused modules.
- Signature: `runHealthAgent(task: string, maxRounds = 3): Promise<RunHealthAgentResult>`.
- Validates that `maxRounds` is a positive integer before any model call.
- Measures wall-clock duration from the start of the valid harness run until a returned terminal verdict.

## Public result contract

```ts
interface RunHealthAgentResult {
  plan: string;
  review: Review;
  rounds: RoundState[];
  finalScore: number | null;
  promptVersions: {
    coach: string;
    reviewer: string;
  };
  durationMs: number;
}
```

For normal returned results, `finalScore` is non-null only when the terminal verdict is `approve`. A professional-referral verdict therefore returns `null` while retaining the reviewer score in `review` and `rounds`.

## Agent modules and prompts

- `src/agents/healthCoach.ts` and `src/agents/safetyReviewer.ts` remain SDK-agent factories.
- Each factory accepts `instructions: string`; neither module reads files or owns prompt versions.
- `safetyReviewer.ts` no longer owns the shared review schema/parser because those are harness controls.
- The current prompt bodies move verbatim to `prompts/healthCoach.v1.md` and `prompts/safetyReviewer.v1.md`.

## API and UI

- The API route keeps the same request validation and simply serializes the expanded result.
- The UI keeps hiding the plan for `needs_human_professional`.
- The review summary shows `finalScore`, `durationMs`, and both prompt versions.
- Round history uses a native collapsed `<details>` section. Its summary identifies the number of rounds; each row reads `Round N — verdict — score/10` and does not duplicate full plans or issue text.
- Existing result styling is extended only as needed for the new metadata and round list.

## Verification

- Run `npm run typecheck` from the repository root.
- Run `npm run build` from the repository root.
- Perform the no-cost route smoke test with an empty/whitespace task and expect HTTP 400; do not send a real non-empty request without explicit intent because it invokes DeepSeek and may incur cost.

## Builder notes

- Preserve the exact coach/reviewer input strings currently composed by the harness.
- Preserve the current maximum-three-round behavior when `maxRounds` is omitted.
- Use explicit domain names and exports; do not introduce a shared `utils` module.
