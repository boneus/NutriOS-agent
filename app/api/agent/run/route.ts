import { runHealthAgent } from "@/src/harness/runHealthAgent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const task = typeof body === "object" && body !== null && "task" in body
      ? body.task
      : undefined;

    if (typeof task !== "string" || !task.trim()) {
      return Response.json({ error: "Поле task должно быть непустой строкой" }, { status: 400 });
    }

    return Response.json(await runHealthAgent(task));
  } catch (error) {
    const message = error instanceof SyntaxError
      ? "Тело запроса должно содержать валидный JSON"
      : error instanceof Error ? error.message : "Неизвестная ошибка";
    const status = error instanceof SyntaxError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
