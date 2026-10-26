# Markdown Health MCP Implementation Plan

> **For agentic workers:** implement tasks sequentially. Project instructions explicitly prohibit tests/TDD, and the user prohibited commits.

**Goal:** Route profile, logs, recipes, and approved plan persistence through one local stdio MCP server per health-agent run.

**Architecture:** A focused MCP server exposes Markdown data tools/resources. A client factory owns OpenAI Agents SDK stdio lifecycle and agent-specific tool filtering; the harness opens it once and closes it in `finally`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@openai/agents`, `tsx`, Next.js.

**Spec:** `docs/superpowers/specs/2026-10-26-markdown-health-mcp-design.md`

## Global Constraints

- No external MCP servers or network transports.
- Preserve the coach/reviewer loop and post-approval persistence boundary.
- Keep shopping and workouts as local tools.
- Do not expose `append_daily_log` to an agent.
- Do not add tests or commit changes.

## Tasks

### 1. Implement the Markdown MCP server

**Files:** create `src/mcp/markdownHealthServer.ts`; modify dependency manifests.

- Register the five specified tools with Zod schemas and text/structured results.
- Register the four fixed resources and map each to its Markdown file.
- Connect with `StdioServerTransport`; keep stdout protocol-clean.

### 2. Add the lifecycle-managed Agents SDK client

**Files:** create `src/mcp/markdownHealthClient.ts`; modify `src/agents/healthCoach.ts`.

- Construct `MCPServerStdio` using the local `tsx` executable and project cwd.
- Filter read tools to `Health Coach`, `save_health_plan` to `Health Coach Finalizer`, and block `append_daily_log` for all agents.
- Let `createHealthCoach` accept both local tools and MCP servers.

### 3. Integrate MCP into the harness

**Files:** modify `src/harness/runHealthAgent.ts` and `prompts/healthCoach.v2.md`.

- Open one server per non-empty run and close it in `finally`.
- Keep workout local in drafting and shopping local in finalization.
- Require `save_health_plan` after approval and retain existing generic tool-call collection.

### 4. Add inspection and documentation

**Files:** create `scripts/mcpInspect.ts`; modify `package.json`, `README.md`.

- Add `npm run mcp:inspect` to list tools and resources through the real stdio client.
- Document lifecycle, command usage, tool split, and “До MCP / После MCP”.

### 5. Verify

- Run `npm run mcp:inspect` and confirm five tools/four resources.
- Run `npm run typecheck`.
- Run `npm run build`.
- Inspect `git diff` and report that `npm run eval` was not run because it invokes DeepSeek.
