import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createEmbedding } from "../src/rag/embeddings";
import { getRagConfig } from "../src/rag/config";

interface KnowledgeSection { file: string; heading: string; content: string; }

function splitSections(file: string, markdown: string): KnowledgeSection[] {
  return markdown.split(/(?=^##\s+)/m).filter((section) => section.startsWith("## ")).map((section) => {
    const [headingLine, ...body] = section.trim().split("\n");
    const heading = headingLine.replace(/^##\s+/, "").trim();
    const content = section.trim();
    if (!heading || body.join("\n").trim().length === 0) throw new Error(`В ${file} найдена пустая секция`);
    return { file, heading, content };
  });
}

async function supabaseRequest(path: string, init: RequestInit): Promise<Response> {
  const config = getRagConfig();
  return fetch(`${config.supabaseUrl}${path}`, { ...init, headers: {
    "apikey": config.supabaseServiceRoleKey,
    "Authorization": `Bearer ${config.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
    ...init.headers,
  } });
}

async function main(): Promise<void> {
  const knowledgeDirectory = join(process.cwd(), "knowledge");
  const files = (await readdir(knowledgeDirectory)).filter((file) => file.endsWith(".md")).sort();
  if (files.length === 0) throw new Error("В knowledge/ нет Markdown-файлов для ingest");
  const sections = (await Promise.all(files.map(async (file) =>
    splitSections(file, await readFile(join(knowledgeDirectory, file), "utf8")),
  ))).flat();
  const deletion = await supabaseRequest("/rest/v1/knowledge_chunks?id=not.is.null", { method: "DELETE" });
  if (!deletion.ok) throw new Error(`Не удалось очистить knowledge_chunks: HTTP ${deletion.status} ${await deletion.text()}`);
  for (const section of sections) {
    const embedding = await createEmbedding(section.content);
    const insertion = await supabaseRequest("/rest/v1/knowledge_chunks", {
      method: "POST", headers: { "Prefer": "return=minimal" }, body: JSON.stringify({ ...section, embedding }),
    });
    if (!insertion.ok) throw new Error(`Не удалось записать ${section.file} / ${section.heading}: HTTP ${insertion.status} ${await insertion.text()}`);
  }
  console.log(`Ingest завершён: ${sections.length} chunks из ${files.length} файлов.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
