# Health Agent

Next.js-приложение с двумя агентами: Health Coach составляет персональный wellness-план по данным из `data/`, а Safety Reviewer проверяет безопасность, реалистичность и соответствие профилю. Markdown-данные доступны коучу через собственный локальный MCP-сервер. План записывается в `data/output.md` только после verdict `approve`. Harness также сохраняет локальные JSON-трейсы, поддерживает replay старых запусков и последовательные mini-evals.

## Настройка

Требуется Node.js 22 или новее. Установите зависимости:

```bash
npm install
```

Создайте `.env`:

```dotenv
DEEPSEEK_API_KEY=ваш_ключ
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
# Необязательно: включает локальный Notion MCP
NOTION_TOKEN=ntn_...
```

`DEEPSEEK_MODEL` необязателен: по умолчанию используется `deepseek-chat`.

Для RAG также передайте окружению процесса `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY` и
`EMBEDDINGS_MODEL`. Выполните SQL из `supabase/migrations/001_knowledge.sql` в
Supabase SQL Editor, затем запустите `npm run ingest`. Ingest очищает
`knowledge_chunks` перед записью, поэтому повторный запуск не создаёт дублей.

## Memory vs RAG

`profile.md` и `log.md` — личная память: они описывают, кто пользователь, его
контекст и недавние наблюдения. Эти файлы остаются Markdown-данными и доступны
Health Coach через MCP tools; они не переносятся в базу данных. `knowledge/` —
это база знаний: что агент умеет рекомендовать, включая рецепты, правила питания,
тренировочные шаблоны и восстановление. При ingest её секции превращаются в
embeddings и сохраняются в Supabase pgvector. Перед составлением плана коуч ищет
релевантные секции через retrieval tool и использует их как основу ответа.

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

## MCP-серверы как конфигурация

Все интеграции описаны одним массивом `{ name, command, args, env?, enabled }` в `src/mcp/servers.config.ts`; там же декларативно указана видимость tools по фазам и optional env-switch. Generic lifecycle manager `src/mcp/configuredServers.ts` поднимает каждый enabled stdio-процесс, автоматически получает его tools и передаёт единый список агенту. Чтобы добавить сервер, нужна новая запись в конфиге — harness и tool-обёртки менять не нужно. Процессы переиспользуются во всех раундах одного запуска и закрываются в `finally`.

| Имя | Пакет / реализация | Что даёт | Авторизация |
|---|---|---|---|
| `markdown-health` | `src/mcp/markdownHealthServer.ts` | Профиль, логи, рецепты, сохранение плана | Локальный процесс |
| `filesystem` | `@modelcontextprotocol/server-filesystem@2026.1.14` | Чтение и запись только в `data/` и `plans/` | Нет; allowlist каталогов в аргументах процесса |
| `weather` | `open-meteo-mcp-server@2.5.4` | `geocoding`, `weather_forecast` и другие Open-Meteo tools | API-ключ не нужен |
| `notion` | `@notionhq/notion-mcp-server@2.5.2` | Чтение и создание страниц через Notion API | Internal integration token `NOTION_TOKEN`; без токена сервер молча пропускается |

Weather-пакет выбран как актуальный поддерживаемый Open-Meteo MCP с stdio-запуском через `npx -y -p open-meteo-mcp-server@2.5.4 open-meteo-mcp-server`. Он принимает название места через `geocoding`, затем координаты через `weather_forecast`. Open-Meteo бесплатен без ключа для некоммерческого использования. Версии закреплены в конфиге, поэтому обновление внешнего пакета — явное изменение конфигурации.

### Guardrails: «промпт — просьба, конфиг — стена»

- **Filesystem:** prompt просит писать только запрошенный `plans/<дата>.md`, но настоящая граница — абсолютные пути только `data/` и `plans/`, переданные серверу при запуске. Весь проект и родительские каталоги недоступны.
- **Notion:** prompt разрешает запись только в «Wellness», но настоящая граница — права internal integration. Перед использованием в Notion откройте настройки integration → Access и предоставьте доступ только одной странице или базе **Wellness**. Сервер включается автоматически лишь при непустом `NOTION_TOKEN`; OAuth не используется.
- **Weather:** сервер по природе read-only и не меняет локальные или облачные данные, поэтому отдельный write-guardrail ему не требуется. Это пример того, что риск разных MCP-серверов различается.
- **Фазы:** drafting coach видит read-only health/weather capabilities. Filesystem и Notion выдаются только finalizer-у после `approve`; у markdown-health по-прежнему строгий allowlist, и `append_daily_log` не получает ни один агент.

### Демо

В UI можно отправить:

- `Спланируй тренировку на завтра с учётом погоды` — агент читает город из `data/profile.md`, вызывает `[weather] geocoding` и `[weather] weather_forecast`, ссылается на прогноз и при плохих условиях выбирает зал или домашний вариант.
- `Составь wellness-план и сохрани его ещё и в отдельный файл plans/<сегодняшняя дата>.md` — после approval finalizer вызывает `[filesystem] write_file`.
- `Составь wellness-план и сохрани его страницей в мой Notion` — при `NOTION_TOKEN` finalizer создаёт страницу через `[notion]` tool внутри доступной integration области Wellness. Без токена Notion отсутствует в списке tools и остальные сценарии работают как обычно.

Отключение любого сервера через `enabled: false` удаляет его tools без правок harness. Исключение — optional-записи с `enableWhenEnv`: для них также удалите env-switch или переменную окружения; у Notion непустой `NOTION_TOKEN` намеренно включает сервер автоматически.

### Локальный Markdown MCP-контракт

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

Markdown-сервер разрешает пути `data/` относительно `process.cwd()`, поэтому приложение и скрипты нужно запускать из корня репозитория. Все MCP-процессы используют stdio; weather и Notion сами обращаются к соответствующим внешним API.

Проверить контракт сервера без обращения к модели:

```bash
npm run mcp:inspect
```

Команда запускает все enabled stdio-серверы через MCP-клиент, печатает tools каждого источника и resources markdown-health, затем корректно завершает дочерние процессы. Полный контракт включает `append_daily_log`; это не означает, что данный tool доступен Health Coach.

### До MCP / После MCP

**До MCP:** каждая интеграция с данными была отдельным локальным skill, вручную импортированным и подключённым к `Agent.tools`. Агент был связан с конкретными функциями чтения и записи файлов.

**После MCP:** профиль, дневник, рецепты и сохранение плана предоставляет собственный сервер, а filesystem, weather и optional Notion подключаются готовыми пакетами одной конфигурацией. OpenAI Agents SDK получает их неизменённые tools. `suggestWorkoutTemplate` и `generateShoppingList` оставлены обычными локальными tools — в коде виден контраст между прямой функцией и MCP-интеграцией.

Safety Reviewer, reviewer JSON-валидация, scoring, rounds и traces остаются в harness и не переносятся в MCP. Старые data-skills сохранены в `src/skills/` с суффиксом `.legacy.ts` (`profile.legacy.ts`, `logs.legacy.ts`, `recipes.legacy.ts`, `plans.legacy.ts`) для сравнения с подходом «до MCP», но к Health Coach не подключены. `shopping.ts` и `workouts.ts` по-прежнему используются как обычные локальные tools.

## Как дебажить агента

Каждый успешно завершившийся запуск автоматически сохраняет компактный trace в `runs/run-<timestamp>.json`: задачу, модель, версии промптов, раунды reviewer-а с фрагментами планов, tool calls, retrieval queries с заголовками найденных секций, verdict, score и длительность. В compact trace имена имеют вид `[weather] weather_forecast`, `[filesystem] write_file`, `[markdown-health] read_profile`, `[notion] ...` или `[local] suggestWorkoutTemplate`. UI получает структурированный `source` и показывает такой же badge, а поиск знаний отображает как `🔍 knowledge: <query> → N chunks`. Ошибка локальной записи trace не прерывает ответ агента. Рабочие трейсы исключены из Git; `runs/run-example.json` документирует формат.

## Какие MCP могут пригодиться дальше

- **Google Calendar** — планирование тренировок и напоминаний; требует OAuth, поэтому намеренно вынесен за рамки этой конфигурации.
- **Database MCP** (например, PostgreSQL) — аналитика долгосрочных wellness-метрик; подключать с отдельным read/write role и минимальными правами.
- **Web Search MCP** — поиск актуальных общих рекомендаций и местных событий; требует контроля источников и защиты от недоверенного контента.

Чтобы повторить задачу из старого trace на текущей модели и промптах и увидеть сравнение результатов:

```bash
npm run replay runs/run-XXX.json
```

Replay берёт `task` из указанного файла, запускает текущий `runHealthAgent` и сравнивает старые и новые `verdict`, `score`, число раундов, tool calls и версии промптов. Новый прогон также создаёт trace.

После изменения модели, промптов или harness запустите шесть последовательных mini-evals:

```bash
npm run eval
```

Eval-кейсы находятся в `evals/cases/*.json` и выполняются строго последовательно. Таблица покажет `PASS`/`FAIL`; процесс завершится с ненулевым кодом, если хотя бы один кейс не соответствует ожидаемому verdict, минимальному score или обязательному retrieval. Кейс `bad-medical-request` проходит только с verdict `needs_human_professional`.

> **Важно:** `replay` и `eval` делают реальные запросы к DeepSeek и могут повлечь расходы. Каждый их запуск создаёт trace, а каждый результат с verdict `approve` проходит обычную финализацию и обновляет `data/output.md`; запрос списка покупок также может обновить `data/shopping.md`.

Формат eval-кейса:

```json
{
  "name": "case-name",
  "task": "Задача агенту",
  "expect": {
    "verdict": "approve",
    "minScore": 7,
    "retrievalCalled": true
  }
}
```

`expect.verdict` принимает `approve` или `needs_human_professional`; `minScore` и `retrievalCalled` необязательны.

Исходные данные находятся в `data/profile.md` и `data/log.md`; последний одобренный результат — в `data/output.md`.
