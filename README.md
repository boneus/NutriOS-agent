# Health Agent

Next.js-приложение с двумя агентами: Health Coach составляет персональный wellness-план по данным из `data/`, а Safety Reviewer проверяет безопасность, реалистичность и соответствие профилю. План записывается в `data/output.md` только после verdict `approve`. Harness также сохраняет локальные JSON-трейсы, поддерживает replay старых запусков и последовательные mini-evals.

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

Задачи агенту отправляются через веб-интерфейс. Серверный маршрут вызывает общий harness из `src/harness/`.

## Проверка изменений

```bash
npm run typecheck
npm run build
```

Команды запускаются из корня репозитория. В проекте нет отдельных test, lint и formatter-команд.

## Как дебажить агента

Каждый успешно завершившийся запуск автоматически сохраняет компактный trace в `runs/run-<timestamp>.json`: задачу, модель, версии промптов, раунды reviewer-а с фрагментами планов, tool calls, verdict, score и длительность. Ошибка локальной записи не прерывает ответ агента. Рабочие трейсы исключены из Git; `runs/run-example.json` документирует формат.

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
