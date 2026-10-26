import { tool } from "@openai/agents";
import { z } from "zod";
import { searchKnowledge, type KnowledgeChunk } from "./retriever";

const SearchKnowledgeParameters = z.object({
  query: z.string().min(1).describe("Короткий поисковый запрос по задаче пользователя."),
  topK: z.number().int().min(1).max(20).optional().describe("Число подходящих секций, по умолчанию 5."),
}).strict();

export interface KnowledgeRetrievalTrace {
  query: string;
  headings: string[];
  chunkCount: number;
}

export function createSearchKnowledgeTool(onSearch: (trace: KnowledgeRetrievalTrace) => void) {
  return tool({
    name: "searchKnowledge",
    description: "Ищи в базе знаний рецепты, правила питания, шаблоны тренировок, правила восстановления.",
    parameters: SearchKnowledgeParameters,
    execute: async ({ query, topK }): Promise<KnowledgeChunk[]> => {
      const chunks = await searchKnowledge(query, topK);
      onSearch({ query, headings: chunks.map(({ heading }) => heading), chunkCount: chunks.length });
      return chunks;
    },
  });
}
