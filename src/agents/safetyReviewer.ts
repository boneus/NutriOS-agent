import { Agent } from "@openai/agents";

export function createSafetyReviewer(model: string, instructions: string) {
  // The reviewer intentionally has no tools: review must be deterministic in scope
  // and free of reads, writes, or any other side effects.
  return new Agent({ name: "Safety Reviewer", instructions, model });
}
