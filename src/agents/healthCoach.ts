import { Agent, type MCPServer, type Tool } from "@openai/agents";
import { suggestWorkoutTemplateTool } from "../skills/workouts";

interface HealthCoachOptions {
  name?: string;
  tools?: Tool[];
  mcpServers?: MCPServer[];
}

export function createHealthCoach(
  model: string,
  instructions: string,
  options: HealthCoachOptions = {},
) {
  return new Agent({
    name: options.name ?? "Health Coach",
    instructions,
    model,
    tools: options.tools ?? [suggestWorkoutTemplateTool],
    mcpServers: options.mcpServers ?? [],
  });
}
