"use client";

import { FormEvent, useState } from "react";
import type { RunHealthAgentResult } from "@/src/harness/runHealthAgent";

type Status = "idle" | "running" | "result";

export default function Home() {
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<RunHealthAgentResult | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTask = task.trim();
    if (!normalizedTask) {
      setError("Введите задачу для агента.");
      return;
    }

    setStatus("running");
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: normalizedTask }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload
          ? String(payload.error)
          : "Не удалось запустить агента";
        throw new Error(message);
      }
      setResult(payload as RunHealthAgentResult);
      setStatus("result");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Произошла неизвестная ошибка");
      setStatus("idle");
    }
  }

  const needsProfessional = result?.review.verdict === "needs_human_professional";

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Health Agent</p>
        <h1>Персональный wellness-план</h1>
        <p className="intro">Опишите задачу. Коуч подготовит план, а отдельный агент проверит его безопасность и реалистичность.</p>

        <form onSubmit={submit}>
          <label htmlFor="task">Задача</label>
          <textarea
            id="task"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="Например: составь план питания и активности на неделю"
            rows={5}
            disabled={status === "running"}
          />
          <button type="submit" disabled={status === "running" || !task.trim()}>
            {status === "running" ? "Агенты работают…" : "Составить план"}
          </button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {status === "result" && result && (
        <section className="result" aria-live="polite">
          {needsProfessional ? (
            <div className="warning" role="alert">
              <h2>Нужна консультация специалиста</h2>
              <p>Запрос выходит за рамки wellness-рекомендаций. План скрыт: обратитесь к подходящему квалифицированному специалисту.</p>
            </div>
          ) : (
            <article>
              <h2>План</h2>
              <pre>{result.plan}</pre>
            </article>
          )}

          <aside>
            <h2>Проверка</h2>
            <dl>
              <div><dt>Verdict</dt><dd>{result.review.verdict}</dd></div>
              <div><dt>Score</dt><dd>{result.review.score}/10</dd></div>
              <div><dt>Rounds</dt><dd>{result.rounds}</dd></div>
            </dl>
            <h3>Issues</h3>
            {result.review.issues.length > 0 ? (
              <ul>{result.review.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            ) : <p>Замечаний нет.</p>}
          </aside>
        </section>
      )}
    </main>
  );
}
