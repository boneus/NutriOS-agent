# Repository guidance

## Runtime flow

- The product entrypoint is the UI; do not add a root application CLI. `app/page.tsx` calls `POST /api/agent/run`, which delegates to `src/harness/runHealthAgent.ts`. `scripts/replay.ts` and `scripts/eval.ts` are development-only `tsx` utilities and must reuse that harness.
- Run commands from the repository root. The harness resolves `data/`, `prompts/`, `runs/`, and `evals/cases/` from `process.cwd()`.
- Keep versioned prompt text in `prompts/`; keep agent construction in `src/agents/`. `src/harness/validateReview.ts` owns the shared reviewer schema and parser contract.
- `runHealthAgent` is the single execution path for UI, replay, and eval. Keep replay and eval sequential; do not introduce workers, queues, or parallel model calls.
- MCP integration lives in `src/mcp/`: `markdownHealthServer.ts` defines the local contract, `servers.config.ts` is the stdio server registry, and `configuredServers.ts` owns generic lifecycle, filtering, and source classification. Do not add a network MCP transport.
- Start one process per enabled config entry for each `runHealthAgent` call, reuse them across all coach/finalizer rounds, and close them in `finally`. Servers and harness resolve paths from `process.cwd()`, so run all entrypoints from the repository root.
- MCP resources are for explicit MCP-client reads; they are not automatically inserted into agent context. Health Coach obtains user data through MCP tools.

## Safety and persistence invariants

- Preserve the coach → safety-reviewer loop: at most 3 plan rounds and exactly one retry after an invalid reviewer JSON response.
- The safety reviewer must receive both the original user task and the proposed plan so prohibited medical intent cannot be hidden by a cautious coach response.
- Write `data/output.md` only when the reviewer returns `approve`. Return `needs_human_professional` without writing; the UI must continue hiding the generated plan for that verdict.
- Preserve MCP capability separation in `configuredServers.ts`: for markdown-health, drafting `Health Coach` may receive only `read_profile`, `read_recent_logs`, and `list_recipes`; `Health Coach Finalizer` may receive only `save_health_plan`; no agent may receive `append_daily_log`. External write-capable servers are finalizer-only. Enforce this with `toolFilter`, not prompt instructions alone.
- Keep `suggestWorkoutTemplate` and `generateShoppingList` as direct local tools to preserve the local-tool versus MCP-tool example. `profile.legacy.ts`, `logs.legacy.ts`, `recipes.legacy.ts`, and `plans.legacy.ts` are unused pre-MCP examples; keep the `.legacy.ts` marker and do not import or reconnect them to Health Coach.
- Every successfully completed harness run writes a best-effort local trace through `src/harness/traceRun.ts`. Trace write failures must be logged without failing or changing the agent result.
- Keep trace JSON compact: full task, model and prompt versions, up to 500 characters of each round's plan, review, local and MCP tool call names in the same `toolCalls` array, final score, verdict, duration, and timestamps. Do not add external observability services.
- Keep tool-source classification centralized outside the UI: `ToolCallDetails.source` is a configured server name or `"local"`, classified by `ConfiguredMcpServers`. `app/page.tsx` only renders the supplied source badge. Compact trace tool names include `[source]` prefixes without adding a separate source field.
- Ignore generated `runs/*` files except the tracked `runs/run-example.json` format example. Never commit real traces because tasks and plan excerpts may contain user data.
- A real non-empty API request invokes DeepSeek and may incur cost. For a no-cost route smoke test, POST an empty/whitespace `task` and expect HTTP 400.
- `npm run replay` and `npm run eval` also invoke DeepSeek, create traces, and can update `data/output.md` (and `data/shopping.md` when requested) after approval. Do not run them merely as no-cost verification.

## Environment

- Use Node.js 22+ and `npm`; `package-lock.json` is authoritative.
- Keep `@modelcontextprotocol/sdk` and `tsx` available at runtime: the Next.js harness starts the TypeScript MCP server as a child process through the local `tsx` executable.
- Runtime requires `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL`. `DEEPSEEK_MODEL` is optional and defaults to `deepseek-chat`. Never commit `.env`.

## Verification

- There is no test, lint, or formatter setup. Run, in order:
  1. `npm run mcp:inspect`
  2. `npm run typecheck`
  3. `npm run build`
- `npm run mcp:inspect` is a no-model smoke check. It must list all enabled servers and their tools, plus all four fixed markdown-health resources. The markdown-health list includes `append_daily_log`, even though agent-side filtering hides that tool from agents.
- `npm run replay <trace-path>` compares one historical run with a new run. `npm run eval` executes all five JSON cases sequentially and exits nonzero on any mismatch; `bad-medical-request` must require `needs_human_professional`.
- `npm run dev` serves the UI at `http://localhost:3000`; `npm start` requires a successful production build first.

Don't use tests and TDD.
Keep the code base moduled and with good documentation.
Use the separation of concerns principle.
