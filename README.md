# Health Agent

Next.js-приложение с двумя агентами: Health Coach составляет персональный wellness-план по данным из `data/`, а Safety Reviewer проверяет безопасность, реалистичность и соответствие профилю. Markdown-данные доступны коучу через собственный локальный MCP-сервер. План записывается в `data/output.md` только после verdict `approve`. Harness также сохраняет локальные JSON-трейсы, поддерживает replay старых запусков и последовательные mini-evals.

## Настройка

Требуется Node.js 20.12 или новее. Установите зависимости:

```bash
npm install
```

Создайте `.env`:

```dotenv
DEEPSEEK_API_KEY=ваш_ключ
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

`DEEPSEEK_MODEL` необязателен: по умолчанию используется `deepseek-chat`.

## Веб-интерфейс

```bash
npm run dev
```

Откройте <http://localhost:3000>. Production-режим:

```bash
npm run build
npm start
```

Задачи агенту отправляются через веб-интерфейс. Серверный маршрут вызывает общий harness из `src/harness/`. UI, replay и eval используют один путь выполнения — `runHealthAgent`.

## Проверка изменений

```bash
npm run mcp:inspect
npm run typecheck
npm run build
```

Команды запускаются из корня репозитория. `mcp:inspect` не обращается к DeepSeek и не изменяет Markdown-данные: команда только запрашивает списки tools и resources. В проекте нет отдельных test, lint и formatter-команд.

## Локальный Markdown MCP-сервер

`src/mcp/markdownHealthServer.ts` — отдельный MCP-процесс со stdio-транспортом. `src/mcp/markdownHealthClient.ts` настраивает запуск процесса и фильтрацию tools. На каждый вызов `runHealthAgent` harness поднимает один экземпляр сервера, использует его во всех раундах этого запуска и закрывает в `finally` — в том числе при ошибке агента или reviewer-а.

Сервер публикует пять tools:

- `read_profile`, `read_recent_logs`, `list_recipes` — доступны drafting Health Coach;
- `save_health_plan` — доступен только финализатору после verdict `approve`;
- `append_daily_log` — есть в MCP-контракте, но намеренно не выдаётся ни одному агенту.

Разделение обеспечивается `toolFilter` в MCP-клиенте, а не только текстом prompt-а. Поэтому drafting-фаза технически не может вызвать запись плана до одобрения Safety Reviewer.

| MCP capability | Markdown-файл | Доступ агенту |
|---|---|---|
| `read_profile` / `profile://me` | `data/profile.md` | Health Coach: tool |
| `read_recent_logs` / `logs://recent` | `data/log.md` | Health Coach: tool |
| `list_recipes` / `recipes://all` | `data/recipes.md` | Health Coach: tool |
| `save_health_plan` / `plans://latest` | `data/output.md` | Finalizer: write-tool; resource доступен MCP-клиентам |
| `append_daily_log` | `data/log.md` | Не выдаётся агентам |

Resources и tools — разные MCP-примитивы. OpenAI Agents SDK подключает к агенту MCP **tools**; resources предназначены для явного чтения MCP-клиентами и не добавляются в prompt автоматически. `logs://recent` возвращает последние семь записей, а tool `read_recent_logs` принимает `days` от 1 до 30.

Сервер разрешает пути `data/` относительно `process.cwd()`, поэтому приложение и скрипты нужно запускать из корня репозитория. Никакой сетевой транспорт или внешний MCP-сервер не используется.

Проверить контракт сервера без обращения к модели:

```bash
npm run mcp:inspect
```

Команда запускает реальный stdio-сервер через MCP-клиент, печатает список tools и resources и корректно завершает дочерний процесс. Она показывает полный контракт сервера, включая `append_daily_log`; это не означает, что данный tool доступен Health Coach.

### До MCP / После MCP

**До MCP:** каждая интеграция с данными была отдельным локальным skill, вручную импортированным и подключённым к `Agent.tools`. Агент был связан с конкретными функциями чтения и записи файлов.

**После MCP:** профиль, дневник, рецепты и сохранение плана предоставляет стандартный MCP-сервер. OpenAI Agents SDK получает его как источник tools, поэтому MCP-вызовы попадают в тот же поток `function_call` и в тот же `toolCalls` трейса. При этом `suggestWorkoutTemplate` и `generateShoppingList` оставлены обычными локальными tools — в коде виден контраст между прямой функцией и MCP-интеграцией.

Safety Reviewer, reviewer JSON-валидация, scoring, rounds и traces остаются в harness и не переносятся в MCP. Старые data-skills сохранены в `src/skills/` с суффиксом `.legacy.ts` (`profile.legacy.ts`, `logs.legacy.ts`, `recipes.legacy.ts`, `plans.legacy.ts`) для сравнения с подходом «до MCP», но к Health Coach не подключены. `shopping.ts` и `workouts.ts` по-прежнему используются как обычные локальные tools.

## Как дебажить агента

Каждый успешно завершившийся запуск автоматически сохраняет компактный trace в `runs/run-<timestamp>.json`: задачу, модель, версии промптов, раунды reviewer-а с фрагментами планов, tool calls, verdict, score и длительность. MCP-вызовы (`read_profile`, `read_recent_logs`, `list_recipes`, `save_health_plan`) записываются в тот же массив `toolCalls`, что и локальные tools. В ответе UI каждый элемент `toolCallDetails` содержит `source: "mcp" | "local"`, поэтому рядом с вызовом отображается источник — `MCP` или `Локальный tool`. Компактный trace при этом не раздувается: в нём остаётся только массив имён `toolCalls`. Ошибка локальной записи не прерывает ответ агента. Рабочие трейсы исключены из Git; `runs/run-example.json` документирует формат.

Чтобы повторить задачу из старого trace на текущей модели и промптах и увидеть сравнение результатов:

```bash
npm run replay runs/run-XXX.json
```

Replay берёт `task` из указанного файла, запускает текущий `runHealthAgent` и сравнивает старые и новые `verdict`, `score`, число раундов, tool calls и версии промптов. Новый прогон также создаёт trace.

После изменения модели, промптов или harness запустите пять последовательных mini-evals:

```bash
npm run eval
```

Eval-кейсы находятся в `evals/cases/*.json` и выполняются строго последовательно. Таблица покажет `PASS`/`FAIL`; процесс завершится с ненулевым кодом, если хотя бы один кейс не соответствует ожидаемому verdict или минимальному score. Кейс `bad-medical-request` проходит только с verdict `needs_human_professional`.

> **Важно:** `replay` и `eval` делают реальные запросы к DeepSeek и могут повлечь расходы. Каждый их запуск создаёт trace, а каждый результат с verdict `approve` проходит обычную финализацию и обновляет `data/output.md`; запрос списка покупок также может обновить `data/shopping.md`.

Формат eval-кейса:

```json
{
  "name": "case-name",
  "task": "Задача агенту",
  "expect": {
    "verdict": "approve",
    "minScore": 7
  }
}
```

`expect.verdict` принимает `approve` или `needs_human_professional`; `minScore` необязателен.

Исходные данные находятся в `data/profile.md` и `data/log.md`; последний одобренный результат — в `data/output.md`.
