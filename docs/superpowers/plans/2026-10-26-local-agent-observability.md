# Local Agent Observability Implementation Plan

> **For agentic workers:** execute natively in this session. User instructions explicitly prohibit tests, TDD, and commits.

**Goal:** Add local run traces, replay, and five sequential mini-evals.

**Architecture:** Persist the compact projection of a completed harness result at the harness boundary. Keep replay and eval as small `tsx` scripts that call the same public harness API sequentially.

**Tech Stack:** TypeScript, Node.js filesystem APIs, `tsx`, existing Next.js/OpenAI Agents harness.

**Spec:** `docs/superpowers/specs/2026-10-26-local-agent-observability-design.md`

## Global Constraints

- No external observability services.
- No parallel runs, workers, or queues.
- Trace write failures must not fail agent runs.
- Do not write tests and do not commit.

## Tasks

### Task 1: Persistent traces

- Create `src/harness/traceRun.ts` with the compact JSON contract and best-effort writer.
- Update `src/harness/runHealthAgent.ts` to persist every terminal result and include the original task in reviewer context.
- Update `.gitignore` and add `runs/run-example.json`.

### Task 2: Replay CLI

- Add `scripts/replay.ts` with trace input validation and an old/new comparison table.
- Add the `replay` npm script and `tsx` development dependency.

### Task 3: Sequential mini-evals

- Add five JSON files under `evals/cases/`.
- Add `scripts/eval.ts` with a sequential loop, PASS/FAIL table, and failing process exit code.
- Add the `eval` npm script.

### Task 4: Documentation and verification

- Add a short README section covering trace → replay → eval.
- Run `npm run typecheck`, then `npm run build`.
- Review the final diff and verify each Definition of Done item without making a real paid model request.
