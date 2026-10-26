import { MCPServerStdio } from "@openai/agents";
import { join } from "node:path";

const DRAFT_AGENT_NAME = "Health Coach";
const FINALIZER_AGENT_NAME = "Health Coach Finalizer";
const DRAFT_TOOLS = new Set(["read_profile", "read_recent_logs", "list_recipes"]);
const MARKDOWN_HEALTH_MCP_TOOLS = new Set([
  ...DRAFT_TOOLS,
  "append_daily_log",
  "save_health_plan",
]);

export function isMarkdownHealthMcpTool(toolName: string): boolean {
  return MARKDOWN_HEALTH_MCP_TOOLS.has(toolName);
}

/**
 * Creates the one stdio MCP process used by a complete harness run.
 * Agent-name filtering preserves the post-review write boundary while keeping
 * all Markdown capabilities available to inspector clients.
 */
export function createMarkdownHealthMcpServer(): MCPServerStdio {
  const root = process.cwd();

  return new MCPServerStdio({
    name: "markdown-health-data",
    command: process.execPath,
    args: [
      join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(root, "src", "mcp", "markdownHealthServer.ts"),
    ],
    cwd: root,
    cacheToolsList: true,
    toolFilter: async ({ agent }, tool) => {
      if (agent.name === DRAFT_AGENT_NAME) return DRAFT_TOOLS.has(tool.name);
      if (agent.name === FINALIZER_AGENT_NAME) return tool.name === "save_health_plan";
      return false;
    },
  });
}
