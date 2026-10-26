import { MCPServerStdio, type MCPServer } from "@openai/agents";
import { MCP_SERVERS, type McpServerConfig } from "./servers.config";

export type ToolSource = McpServerConfig["name"] | "local";

interface ConnectedServer {
  config: McpServerConfig;
  server: MCPServerStdio;
  tools: string[];
}

function isToolVisible(config: McpServerConfig, agentName: string, toolName: string): boolean {
  const allowed = agentName === "Health Coach Finalizer"
    ? config.finalizerTools
    : config.draftTools;
  return allowed === "all" || allowed.includes(toolName);
}

function isEnabled(config: McpServerConfig): boolean {
  if (config.enabled) return true;
  if (!config.enableWhenEnv) return false;
  return Boolean(process.env[config.enableWhenEnv]?.trim());
}

function createServer(config: McpServerConfig): MCPServerStdio {
  return new MCPServerStdio({
    name: config.name,
    command: config.command,
    args: config.args,
    env: config.env,
    cwd: process.cwd(),
    cacheToolsList: true,
    toolFilter: async ({ agent }, tool) => isToolVisible(config, agent.name, tool.name),
  });
}

export class ConfiguredMcpServers {
  private readonly connected: ConnectedServer[] = [];
  private readonly sourcesByTool = new Map<string, ToolSource>();

  async connect(): Promise<void> {
    try {
      for (const config of MCP_SERVERS) {
        if (!isEnabled(config)) continue;

        const server = createServer(config);
        await server.connect();
        const entry: ConnectedServer = { config, server, tools: [] };
        this.connected.push(entry);
        const tools = (await server.listTools()).map(({ name }) => name);
        entry.tools = tools;

        for (const toolName of tools) {
          const existing = this.sourcesByTool.get(toolName);
          if (existing) {
            throw new Error(`MCP tool ${toolName} опубликован серверами ${existing} и ${config.name}`);
          }
          this.sourcesByTool.set(toolName, config.name);
        }
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  all(): MCPServer[] {
    return this.connected.map(({ server }) => server);
  }

  sourceFor(toolName: string): ToolSource {
    return this.sourcesByTool.get(toolName) ?? "local";
  }

  prefixedToolName(toolName: string): string {
    return `[${this.sourceFor(toolName)}] ${toolName}`;
  }

  entries(): ReadonlyArray<ConnectedServer> {
    return this.connected;
  }

  async close(): Promise<void> {
    const servers = this.connected.splice(0).reverse();
    await Promise.allSettled(servers.map(({ server }) => server.close()));
    this.sourcesByTool.clear();
  }
}
