import { getRagConfig } from "./config";

interface EmbeddingsResponse {
  data?: Array<{ embedding?: unknown }>;
}

export async function createEmbedding(input: string): Promise<number[]> {
  const normalizedInput = input.trim();
  if (!normalizedInput) throw new Error("Нельзя создать embedding для пустого текста");

  const config = getRagConfig();
  const response = await fetch(`${config.embeddingsBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.embeddingsApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: config.embeddingsModel, input: normalizedInput }),
  });
  if (!response.ok) {
    throw new Error(`Embedding endpoint вернул HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as EmbeddingsResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number")) {
    throw new Error("Embedding endpoint не вернул числовой embedding в data[0].embedding");
  }
  if (embedding.length !== 1536) {
    throw new Error(`Embedding имеет размерность ${embedding.length}; knowledge_chunks ожидает vector(1536)`);
  }
  return embedding;
}
