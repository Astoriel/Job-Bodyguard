# Job Bodyguard

Chrome Extension + Web Dashboard для защиты от токсичных вакансий.

## Структура

```
/apps
  /extension    - Chrome Extension (Manifest V3)
  /web          - Next.js Dashboard + API
/packages
  /types        - Shared TypeScript types
  /parsers      - Job parsers (LinkedIn, Indeed)
  /ui           - Shared UI components
```

## Быстрый старт

```bash
# Установка зависимостей
pnpm install

# Разработка
pnpm dev

# Сборка
pnpm build
```

## Tech Stack

- **Extension**: React + Vite + CRXJS
- **Web**: Next.js 15 + App Router
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
