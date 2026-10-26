import { ConfiguredMcpServers } from "../src/mcp/configuredServers";

async function main(): Promise<void> {
  const servers = new ConfiguredMcpServers();
  await servers.connect();

  try {
    for (const { config, server, tools } of servers.entries()) {
      console.log(`[${config.name}] Tools:`);
      for (const tool of tools) console.log(`- ${tool}`);
      if (config.name === "markdown-health") {
        const resources = await server.listResources();
        console.log(`[${config.name}] Resources:`);
        for (const resource of resources.resources) console.log(`- ${resource.uri}`);
      }
    }
  } finally {
    await servers.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
