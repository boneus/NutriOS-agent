# Health Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. The user explicitly prohibited tests and TDD, so verification uses the repository's required typecheck/build commands and a no-cost route smoke test.

**Goal:** Refactor the health-agent loop into a versioned, observable harness without changing its coach/reviewer behavior or safety and persistence guarantees.

**Architecture:** `runHealthAgent` remains the public orchestrator and injects versioned prompt text into focused agent factories. Dedicated harness modules own prompt selection, reviewer validation/retry, round history, and score derivation; the API serializes the expanded result and the UI renders its metadata while preserving professional-referral plan hiding.

**Tech Stack:** TypeScript 5.9, Next.js 16 App Router, React 19, `@openai/agents` 0.21, Zod 4, Node.js filesystem APIs.

**Spec:** `docs/superpowers/specs/2026-10-25-health-agent-harness-design.md`

## Global Constraints

- Do not add tests or use TDD.
- Keep the application UI-only; do not add a root CLI entry point.
- Keep the coach → reviewer loop at no more than `maxRounds`, defaulting to exactly `3`.
- Retry reviewer execution exactly once after an invalid output.
- Write only `data/output.md`, and only after `approve`.
- Return `needs_human_professional` without writing and keep its generated plan hidden in the UI.
- Preserve all existing agent prompt wording and coach/reviewer input composition.
- Put versioned prompt files in the repository-root `prompts/` directory and the shared review contract in `src/harness/validateReview.ts`; these task-specific requirements supersede the older placement notes in `AGENTS.md`.
- Do not add evals, replay, trace persistence, databases, external services, dependencies, or generic utility modules.
- Run commands from the repository root with Node.js 20.12+ and `npm`.
- Do not send a non-empty task during verification because it invokes DeepSeek and may incur cost.

## Review Focus

- `maxRounds` values of `0`, negative numbers, fractions, `NaN`, and infinity must fail before filesystem or model work; verify the guard is the first runtime boundary after task normalization.
- Fenced JSON, malformed JSON, and schema-invalid JSON must share the existing cleanup and exactly-one-retry path; inspect the two-attempt loop and its terminal error.
- A `needs_human_professional` terminal round must produce `finalScore: null`, retain its round and review metadata, avoid `output.md`, and remain hidden in the UI.
- A prompt version change must require only a new `prompts/<file>.<version>.md` plus one `ACTIVE_PROMPTS` edit, with missing files failing through normal filesystem errors.
- Round history must contain every completed coach/reviewer pair exactly once and in order, including the terminal round, while score derivation uses the last approved review.

---

### Task 1: Versioned prompt loading

**Files:**
- Create: `prompts/healthCoach.v1.md`
- Create: `prompts/safetyReviewer.v1.md`
- Create: `src/harness/promptVersions.ts`

**Interfaces:**
- Produces: `ACTIVE_PROMPTS: Readonly<{ coach: string; reviewer: string }>`
- Produces: `PromptVersions`, `ActivePrompts`, `loadPrompt(name, version)`, and `loadActivePrompts()`
- Consumes: repository-root `prompts/<prompt-file>.<version>.md` files resolved from `process.cwd()`

- [ ] **Step 1: Move the coach prompt verbatim**

Create `prompts/healthCoach.v1.md` with the exact text currently inside `COACH_PROMPT`, excluding only the template literal's framing leading/trailing newline.

- [ ] **Step 2: Move the reviewer prompt verbatim**

Create `prompts/safetyReviewer.v1.md` with the exact text currently inside `REVIEWER_PROMPT`, excluding only the template literal's framing leading/trailing newline.

- [ ] **Step 3: Implement prompt version loading**

In `src/harness/promptVersions.ts`, define:

```ts
export const ACTIVE_PROMPTS = {
  coach: "v1",
  reviewer: "v1",
} as const;

export interface PromptVersions {
  coach: string;
  reviewer: string;
}

export interface ActivePrompts {
  coach: string;
  reviewer: string;
  versions: PromptVersions;
}

export function loadPrompt(
  name: keyof typeof ACTIVE_PROMPTS,
  version: string,
): Promise<string>;

export function loadActivePrompts(): Promise<ActivePrompts>;
```

Use a private explicit filename map (`coach` → `healthCoach`, `reviewer` → `safetyReviewer`), `join(process.cwd(), "prompts", ...)`, and `readFile(..., "utf8")`. Load active prompts in parallel and return a copied version object rather than exposing a mutable alias.

- [ ] **Step 4: Run the compiler gate**

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors; the new prompt loader is additive and existing runtime wiring is still intact.

- [ ] **Step 5: Commit the prompt boundary**

```powershell
git add prompts src/harness/promptVersions.ts
git commit -m "refactor: version agent prompts"
```

### Task 2: Reviewer validation, round history, and scoring

**Files:**
- Create: `src/harness/validateReview.ts`
- Create: `src/harness/rounds.ts`
- Create: `src/harness/score.ts`

**Interfaces:**
- Produces: `ReviewSchema`, `Review`, `parseReview(raw: string): Review`, and `validateReview(requestReview: () => Promise<unknown>): Promise<Review>`
- Produces: `RoundState` and `RoundHistory`
- Produces: `ScoreSummary` and `calculateScore(rounds: readonly RoundState[]): ScoreSummary`
- Consumes: reviewer `finalOutput` through an SDK-independent callback

- [ ] **Step 1: Implement the shared review contract and safe parser**

Move the strict schema and inferred type into `validateReview.ts`. Keep the current Markdown-fence cleanup. Parse JSON inside a guarded boundary, then pass the value to `ReviewSchema.safeParse`; on failure, throw a validation error so every invalid reviewer response follows the same retry path.

- [ ] **Step 2: Implement exactly-one-retry validation**

`validateReview` calls `requestReview` at most twice. Each attempt requires a string output and calls `parseReview`. Log the existing warning only after the first invalid output, and after the second throw the existing `Reviewer дважды вернул невалидный JSON: ...` error shape. Do not retry successful schema-valid reviews or non-validation orchestration outside this boundary.

- [ ] **Step 3: Implement round state**

In `rounds.ts`, define:

```ts
export interface RoundState {
  round: number;
  plan: string;
  review: Review;
}

export class RoundHistory {
  add(state: RoundState): void;
  all(): RoundState[];
}
```

Store states privately, append once per completed reviewer cycle, and return a new ordered array from `all()`.

- [ ] **Step 4: Implement score derivation**

In `score.ts`, define:

```ts
export interface ScoreSummary {
  finalScore: number | null;
  improved: boolean;
}

export function calculateScore(
  rounds: readonly RoundState[],
): ScoreSummary;
```

Find the last approved review for `finalScore`; use `null` if none exists. Set `improved` only when there are at least two rounds and the last review score is greater than the first. Keep `improved` internal to harness scoring; it is not part of the public result.

- [ ] **Step 5: Run a focused static inspection and compiler gate**

Confirm that the three new modules do not import `Runner`, `Agent`, React, filesystem APIs, or persistence code, and that among these modules only `validateReview.ts` imports Zod.

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors; the new modules are additive and existing runtime wiring is still intact.

- [ ] **Step 6: Commit the harness primitives**

```powershell
git add src/harness/validateReview.ts src/harness/rounds.ts src/harness/score.ts
git commit -m "refactor: add harness controls"
```

### Task 3: Rebuild `runHealthAgent` as the orchestrator

**Files:**
- Modify: `src/harness/runHealthAgent.ts`
- Modify: `src/agents/healthCoach.ts`
- Modify: `src/agents/safetyReviewer.ts`

**Interfaces:**
- Consumes: all interfaces produced by Tasks 1 and 2
- Produces: `runHealthAgent(task: string, maxRounds?: number): Promise<RunHealthAgentResult>`
- Produces: expanded `RunHealthAgentResult` consumed by the API route and UI
- Produces: `createHealthCoach(model: string, instructions: string)` and `createSafetyReviewer(model: string, instructions: string)`

- [ ] **Step 1: Reduce agent files to SDK factories**

Remove prompt constants from both agent modules and remove Zod/schema/parser code from `safetyReviewer.ts`. Each factory receives `instructions` as its second parameter and passes it unchanged to `new Agent({ name, instructions, model })`.

- [ ] **Step 2: Replace the public result contract**

Define and export:

```ts
export interface RunHealthAgentResult {
  plan: string;
  review: Review;
  rounds: RoundState[];
  finalScore: number | null;
  promptVersions: PromptVersions;
  durationMs: number;
}
```

Do not include `improved`.

- [ ] **Step 3: Validate inputs before paid or filesystem work**

Keep task trimming and the existing empty-task error. Add a positive-integer guard for `maxRounds`; reject non-finite, fractional, zero, or negative values before environment loading, file reads, prompt reads, or model calls. Start the duration timer immediately after both inputs are valid.

- [ ] **Step 4: Load data and active prompts**

Load `profile.md`, `log.md`, and `loadActivePrompts()` concurrently. Keep environment/provider/runner construction behavior and model fallback unchanged. Create both agents using the injected active prompt text.

- [ ] **Step 5: Delegate reviewer execution and validation**

Retain the reviewer input string byte-for-byte. Pass a callback to `validateReview` that runs the reviewer and returns `result.finalOutput`; remove the nested validation/retry function from the orchestrator.

- [ ] **Step 6: Orchestrate and capture every round**

Keep the coach input composition unchanged. Iterate from `1` through `maxRounds`, run coach then reviewer, append `{ round, plan, review }` before inspecting the verdict, and use the review issues for the next revision.

- [ ] **Step 7: Centralize terminal result construction**

Use a local result builder inside `runHealthAgent.ts` that reads `history.all()`, calls `calculateScore`, and returns the public result with copied prompt versions and `Date.now() - startedAt`. For `needs_human_professional`, return without writing. For `approve`, write exactly `${draft}\n` to `data/output.md` and return. On exhaustion, throw a dynamic error mentioning `maxRounds` while preserving the old default-three wording when `maxRounds` is omitted.

- [ ] **Step 8: Run the compiler gate**

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 9: Commit the orchestrator**

```powershell
git add src/agents src/harness/runHealthAgent.ts
git commit -m "refactor: orchestrate health agent harness"
```

### Task 4: Expose harness metadata in the UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Verify unchanged serialization: `app/api/agent/run/route.ts`

**Interfaces:**
- Consumes: expanded `RunHealthAgentResult`
- Preserves: the API request body `{ task: string }` and route-level empty-task HTTP 400 behavior

- [ ] **Step 1: Replace the old numeric rounds display**

Update the summary `<dl>` to show final score (`—` for `null`), duration in milliseconds, and coach/reviewer prompt versions. The terminal `review.score` remains available in the review section and must not be mislabeled as `finalScore` for professional referrals.

- [ ] **Step 2: Add collapsed round history**

Add a native `<details>` element after the summary, closed by default. Its `<summary>` shows `История раундов (N)`, and its list renders each state as `Round {round} — {verdict} — {score}/10`. Use the round number as the key because each round is unique and ordered.

- [ ] **Step 3: Preserve professional-referral hiding**

Keep `needsProfessional` based on the terminal review verdict and leave the current conditional plan rendering intact. The round-history UI must show only verdict/score labels, never hidden plan text.

- [ ] **Step 4: Add minimal responsive styling**

Extend `app/globals.css` for the `<details>`, clickable `<summary>`, and compact history list using the existing color, border, and spacing system. Do not redesign the page.

- [ ] **Step 5: Confirm the route needs no transformation**

Inspect `app/api/agent/run/route.ts` and leave its `Response.json(await runHealthAgent(task))` flow unchanged; the expanded result is serialized automatically. Do not add a route-side result mapper or duplicate types.

- [ ] **Step 6: Run the compiler gate**

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 7: Commit the UI metadata**

```powershell
git add app/page.tsx app/globals.css
git commit -m "feat: show harness run metadata"
```

### Task 5: Verify the complete application

**Files:**
- Verify: all files changed by Tasks 1–4
- Do not modify: `data/output.md`

**Interfaces:**
- Consumes: the complete harness → API → UI flow
- Produces: verification evidence only; no real DeepSeek request

- [ ] **Step 1: Review the final diff against safety invariants**

Run:

```powershell
$mergeBase = git merge-base master HEAD
git diff --check "$mergeBase..HEAD"
```

Expected: exit code `0`, no whitespace errors.

Inspect the diff and confirm the only `writeFile` call still targets `data/output.md` inside the `approve` branch, `needs_human_professional` returns before it, and the UI never renders a round plan.

- [ ] **Step 2: Run the required TypeScript verification**

Run: `npm run typecheck`

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 3: Run the required production build**

Run: `npm run build`

Expected: exit code `0`; Next.js completes the production build successfully.

- [ ] **Step 4: Run the no-cost API smoke test**

Start `npm run dev` from the repository root, wait for `http://localhost:3000`, then POST JSON with a whitespace-only task to `/api/agent/run`.

Expected: HTTP `400` with the existing non-empty-task error; no DeepSeek request and no `data/output.md` write.

- [ ] **Step 5: Verify version-switch extensibility statically**

Confirm that all runtime prompt paths originate in `promptVersions.ts`, that no prompt body remains in agent source, and that changing `ACTIVE_PROMPTS.coach` after adding a matching `healthCoach.<version>.md` requires no other edit.

- [ ] **Step 6: Commit verification-only documentation if changed**

No code commit is needed when verification requires no fixes. If verification reveals a defect, fix only the relevant module, rerun Steps 1–4, and commit the correction with a focused message.
