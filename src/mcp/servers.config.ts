import { loadEnvFile } from "node:process";
import { join } from "node:path";

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  enableWhenEnv?: string;
  draftTools: "all" | string[];
  finalizerTools: "all" | string[];
}

function loadLocalEnv(): void {
  try {
    loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function inheritedEnvironment(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...overrides })
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

loadLocalEnv();

const root = process.cwd();
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const notionToken = process.env.NOTION_TOKEN?.trim();

/**
 * The complete stdio integration surface. Adding another server only requires
 * another entry here; the lifecycle manager and harness discover its tools.
 */
export const MCP_SERVERS: McpServerConfig[] = [
  {
    name: "markdown-health",
    command: process.execPath,
    args: [
      join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(root, "src", "mcp", "markdownHealthServer.ts"),
    ],
    enabled: true,
    draftTools: ["read_profile", "read_recent_logs", "list_recipes"],
    finalizerTools: ["save_health_plan"],
  },
  {
    name: "filesystem",
    command: npxCommand,
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem@2026.1.14",
      join(root, "data"),
      join(root, "plans"),
    ],
    enabled: true,
    draftTools: [],
    finalizerTools: "all",
  },
  {
    name: "weather",
    command: npxCommand,
    args: ["-y", "-p", "open-meteo-mcp-server@2.5.4", "open-meteo-mcp-server"],
    enabled: true,
    draftTools: "all",
    finalizerTools: [],
  },
  {
    name: "notion",
    command: npxCommand,
    args: ["-y", "@notionhq/notion-mcp-server@2.5.2"],
    env: notionToken ? inheritedEnvironment({ NOTION_TOKEN: notionToken }) : undefined,
    enabled: false,
    enableWhenEnv: "NOTION_TOKEN",
    draftTools: [],
    finalizerTools: "all",
  },
];
