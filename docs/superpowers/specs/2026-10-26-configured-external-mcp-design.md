# Configured External MCP Servers — Design

## Intent

Show that stdio MCP integration is configuration rather than per-tool application code: the harness starts every enabled entry from one registry and gives discovered tools to the agent.

## Constraints and safety

- Preserve the coach → reviewer → finalizer loop and the three-round limit.
- Drafting may use read-only external tools; side-effecting filesystem, Notion, and markdown-health tools are available only to the finalizer after approval.
- Keep the markdown-health explicit allowlist: draft gets its three read tools, finalizer gets `save_health_plan`, and no agent gets `append_daily_log`.
- Filesystem receives only absolute `data/` and `plans/` paths as process arguments.
- Notion starts only when `NOTION_TOKEN` is non-empty and relies on integration permissions restricting it to Wellness.
- Weather is intrinsically read-only and requires no credentials.
- External tools are passed through unchanged; no wrappers are introduced.

## Approaches

1. **Generic registry and lifecycle manager (selected).** One config array owns command, arguments, environment, and enabled state. A generic manager starts entries, discovers tool metadata for phase filtering/source attribution, and closes all processes.
2. Per-server client factories. Straightforward, but every integration requires code and defeats the demonstration.
3. Give all tools to the drafting coach. Simplest, but allows writes before reviewer approval and violates the existing safety boundary.

## Runtime flow

After `.env` loading, the harness asks the manager to start enabled servers. Declarative `draftTools` and `finalizerTools` policies determine phase visibility; the markdown-health entry supplies explicit allowlists for its stronger persistence invariant. `enableWhenEnv` generically activates optional token-backed entries. The same connected processes are reused across rounds and closed in `finally`. Tool names discovered from each server map trace/UI calls to the configured name; unmatched direct tools map to `local`.

Approved in conversation on 2026-10-26. No repository commit will be created.
