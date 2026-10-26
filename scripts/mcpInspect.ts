import { createMarkdownHealthMcpServer } from "../src/mcp/markdownHealthClient";

async function main(): Promise<void> {
  const server = createMarkdownHealthMcpServer();
  await server.connect();

  try {
    const [tools, resources] = await Promise.all([
      server.listTools(),
      server.listResources(),
    ]);

    console.log("Tools:");
    for (const tool of tools) console.log(`- ${tool.name}`);

    console.log("\nResources:");
    for (const resource of resources.resources) console.log(`- ${resource.uri}`);
  } finally {
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
