function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

export interface RagConfig {
  embeddingsBaseUrl: string;
  embeddingsApiKey: string;
  embeddingsModel: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export function getRagConfig(): RagConfig {
  return {
    embeddingsBaseUrl: requiredEnv("EMBEDDINGS_BASE_URL").replace(/\/$/, ""),
    embeddingsApiKey: requiredEnv("EMBEDDINGS_API_KEY"),
    embeddingsModel: requiredEnv("EMBEDDINGS_MODEL"),
    supabaseUrl: requiredEnv("SUPABASE_URL").replace(/\/$/, ""),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
