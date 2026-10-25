# Health Agent

Next.js-приложение с двумя агентами: Health Coach составляет персональный wellness-план по данным из `data/`, а Safety Reviewer проверяет безопасность, реалистичность и соответствие профилю. План записывается в `data/output.md` только после verdict `approve`.

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

## Проверка типов

```bash
npm run typecheck
```

Исходные данные находятся в `data/profile.md` и `data/log.md`; последний одобренный результат — в `data/output.md`.
