# Repository guidance

## Runtime flow

- This is UI-only; do not add a root CLI entrypoint. `app/page.tsx` calls `POST /api/agent/run`, which delegates to `src/harness/runHealthAgent.ts`.
- Run commands from the repository root. The harness resolves `data/profile.md`, `data/log.md`, and `data/output.md` from `process.cwd()`.
- Keep agent prompts in `src/agents/`. The reviewer schema and parser in `safetyReviewer.ts` are the shared contract used by the harness and UI result type.

## Safety and persistence invariants

- Preserve the coach → safety-reviewer loop: at most 3 plan rounds and exactly one retry after an invalid reviewer JSON response.
- Write `data/output.md` only when the reviewer returns `approve`. Return `needs_human_professional` without writing; the UI must continue hiding the generated plan for that verdict.
- A real non-empty API request invokes DeepSeek and may incur cost. For a no-cost route smoke test, POST an empty/whitespace `task` and expect HTTP 400.

## Environment

- Use Node.js 20.12+ and `npm`; `package-lock.json` is authoritative.
- Runtime requires `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`. `DEEPSEEK_MODEL` is optional and defaults to `deepseek-chat`. Never commit `.env`.

## Verification

- There is no test, lint, or formatter setup. Run, in order:
  1. `npm run typecheck`
  2. `npm run build`
- `npm run dev` serves the UI at `http://localhost:3000`; `npm start` requires a successful production build first.

Don't use tests and TDD.
Keep the code base moduled and with good documentation.
Use the separation of concerns principle.

