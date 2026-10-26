import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const DATA_DIRECTORY = join(process.cwd(), "data");

function dataPath(fileName: string): string {
  return join(DATA_DIRECTORY, fileName);
}

async function readMarkdown(fileName: string): Promise<string> {
  return readFile(dataPath(fileName), "utf8");
}

function recentLogEntries(log: string, days: number): string {
  const entries = log.split(/(?=^##\s+)/m).filter((part) => part.trimStart().startsWith("## "));
  return entries.slice(-days).join("\n").trim();
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const server = new McpServer({
  name: "markdown-health-data",
  version: "1.0.0",
});

server.registerTool("read_profile", {
  description: "Прочитать постоянный профиль пользователя: цели, режим, ограничения, предпочтения и доступный инвентарь.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, async () => textResult(await readMarkdown("profile.md")));

server.registerTool("read_recent_logs", {
  description: "Получить последние N дневных записей пользователя в хронологическом порядке.",
  inputSchema: {
    days: z.number().int().min(1).max(30)
      .describe("Количество последних дневных записей: от 1 до 30."),
  },
  annotations: { readOnlyHint: true },
}, async ({ days }) => textResult(recentLogEntries(await readMarkdown("log.md"), days)));

server.registerTool("append_daily_log", {
  description: "Добавить переданную Markdown-запись в конец data/log.md.",
  inputSchema: {
    entry: z.string().trim().min(1).describe("Новая дневная запись в Markdown."),
  },
  annotations: { destructiveHint: false },
}, async ({ entry }) => {
  await appendFile(dataPath("log.md"), `\n\n${entry.trim()}\n`, "utf8");
  return textResult("Дневная запись добавлена.");
});

server.registerTool("save_health_plan", {
  description: "Сохранить одобренный финальный wellness-план в data/output.md.",
  inputSchema: {
    markdown: z.string().trim().min(1)
      .describe("Полный одобренный wellness-план в Markdown."),
  },
  annotations: { destructiveHint: true },
}, async ({ markdown }) => {
  await writeFile(dataPath("output.md"), `${markdown.trim()}\n`, "utf8");
  return textResult("План сохранён.");
});

server.registerTool("list_recipes", {
  description: "Прочитать сохранённые любимые рецепты пользователя с ингредиентами.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, async () => textResult(await readMarkdown("recipes.md")));

function registerMarkdownResource(
  name: string,
  uri: string,
  description: string,
  read: () => Promise<string>,
): void {
  server.registerResource(name, uri, {
    description,
    mimeType: "text/markdown",
  }, async () => ({
    contents: [{ uri, mimeType: "text/markdown", text: await read() }],
  }));
}

registerMarkdownResource("profile", "profile://me", "Профиль пользователя", () => readMarkdown("profile.md"));
registerMarkdownResource("recent-logs", "logs://recent", "Последние семь записей дневника", async () => (
  recentLogEntries(await readMarkdown("log.md"), 7)
));
registerMarkdownResource("recipes", "recipes://all", "Все сохранённые рецепты", () => readMarkdown("recipes.md"));
registerMarkdownResource("latest-plan", "plans://latest", "Последний одобренный план", () => readMarkdown("output.md"));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error("Markdown Health MCP server failed:", error);
  process.exitCode = 1;
});
