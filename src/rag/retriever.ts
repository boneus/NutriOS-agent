import { createEmbedding } from "./embeddings";
import { getRagConfig } from "./config";

export interface KnowledgeChunk {
  file: string;
  heading: string;
  content: string;
  similarity: number;
}

interface MatchKnowledgeChunk extends KnowledgeChunk {
  id: string;
}

export async function searchKnowledge(query: string, topK = 5): Promise<KnowledgeChunk[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error("Запрос к базе знаний не должен быть пустым");
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
    throw new Error("topK должен быть целым числом от 1 до 20");
  }

  const config = getRagConfig();
  const embedding = await createEmbedding(normalizedQuery);
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/match_knowledge_chunks`, {
    method: "POST",
    headers: {
      "apikey": config.supabaseServiceRoleKey,
      "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query_embedding: embedding, match_count: topK }),
  });
  if (!response.ok) {
    throw new Error(`Supabase retrieval вернул HTTP ${response.status}: ${await response.text()}`);
  }

  const chunks = await response.json() as MatchKnowledgeChunk[];
  if (!Array.isArray(chunks)) throw new Error("Supabase retrieval вернул некорректный ответ");
  return chunks.map(({ file, heading, content, similarity }) => ({ file, heading, content, similarity }));
}
