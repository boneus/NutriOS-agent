import { Agent, type Tool } from "@openai/agents";
import { getProfileTool } from "../skills/profile";
import { getRecentLogTool } from "../skills/logs";
import { listFavoriteRecipesTool } from "../skills/recipes";
import { suggestWorkoutTemplateTool } from "../skills/workouts";

export const healthCoachTools = [
  getProfileTool,
  getRecentLogTool,
  listFavoriteRecipesTool,
  suggestWorkoutTemplateTool,
];

export function createHealthCoach(model: string, instructions: string, tools: Tool[] = healthCoachTools) {
  return new Agent({ name: "Health Coach", instructions, model, tools });
}
