import { Agent } from "@openai/agents";

export function createSafetyReviewer(model: string, instructions: string) {
  return new Agent({ name: "Safety Reviewer", instructions, model });
}
