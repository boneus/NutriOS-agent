import { Agent } from "@openai/agents";

export function createHealthCoach(model: string, instructions: string) {
  return new Agent({ name: "Health Coach", instructions, model });
}
