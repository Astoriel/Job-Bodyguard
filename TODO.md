# 📋 Job Decoder & Career Bodyguard — Полный TODO

> **Цель**: Chrome-расширение + Web Dashboard для защиты от токсичных вакансий, анализа скрытых данных и адаптации резюме.

---

## 🎯 Фаза 0: Подготовка и Планирование

### 0.1 Исследование и Дизайн
- [ ] Определить целевые платформы для парсинга (LinkedIn, Indeed, Glassdoor, hh.ru?)
- [ ] Исследовать структуру DOM каждой платформы
- [ ] Изучить схему JSON-LD для вакансий (`JobPosting` schema)
- [ ] Определить список red-flag ключевых слов (EN + RU)
- [ ] Создать wireframes для UI компонентов:
  - [ ] Floating Banner (пассивный режим)
  - [ ] Popup/SidePanel (активный анализ)
  - [ ] Diff View (сравнение резюме)
  - [ ] Dashboard страница

### 0.2 Выбор Технологий
- [ ] **Extension**: Manifest V3, React + Vite + CRXJS
- [ ] **Backend**: Node.js/Python FastAPI для LLM прокси
- [ ] **Database**: Supabase (PostgreSQL + Auth + Storage)
- [ ] **AI**: OpenAI API (gpt-4o-mini)
- [ ] **PDF**: pdf-lib или Puppeteer для генерации резюме

### 0.3 Настройка Окружения
- [ ] Создать репозиторий с monorepo структурой
- [ ] Настроить ESLint, Prettier, TypeScript
- [ ] Создать `.env.example` с переменными окружения
- [ ] Настроить CI/CD (GitHub Actions)

---

## 🔍 Фаза 1: Passive Scan (Режим "Forensics") — БЕЗ AI

> **Приоритет**: HIGH | Это MVP core-функционал

### 1.1 Chrome Extension Scaffold
- [ ] Инициализировать проект: `npx create-vite@latest --template react-ts`
- [ ] Настроить CRXJS плагин для Manifest V3
- [ ] Создать базовую структуру:
  ```
  /src
    /background    # Service Worker
    /content       # Content Scripts
    /popup         # Popup UI
    /sidepanel     # Side Panel UI
    /shared        # Общие типы и утилиты
  ```
- [ ] Настроить `manifest.json` с permissions:
  - `activeTab`
  - `storage`
  - `scripting`
  - Host permissions для LinkedIn, Indeed, Glassdoor

### 1.2 Content Script — DOM Parser
- [ ] Создать `JobDataExtractor` класс:
  - [ ] `extractVisibleData()` — парсинг видимого текста вакансии
  - [ ] `extractHiddenMetadata()` — парсинг JSON-LD и meta tags
  - [ ] `extractSalaryData()` — поиск скрытой зарплаты
  - [ ] `extractJobAge()` — вычисление возраста вакансии

- [ ] Реализовать парсеры для каждой платформы:
  - [ ] `LinkedInParser.ts`
  - [ ] `IndeedParser.ts`
  - [ ] `GlassdoorParser.ts`

- [ ] Создать `DateAnalyzer`:
  - [ ] Парсинг `datePosted` из JSON-LD
  - [ ] Парсинг `validThrough` (дата истечения)
  - [ ] Вычисление дней с публикации

### 1.3 Red/Green Flags Engine
- [ ] Создать `FlagAnalyzer` класс:
  - [ ] Хранилище ключевых слов (JSON config):
    ```json
    {
      "redFlags": ["rockstar", "ninja", "family", "stress", "fast-paced", "wear many hats"],
      "greenFlags": ["remote", "flexible", "4-day week", "equity"]
    }
    ```
  - [ ] Метод `analyzeText(text): FlagResult[]`
  - [ ] Поддержка regex паттернов
  - [ ] Весовые коэффициенты для flags

- [ ] Логика определения скрытой зарплаты:
  - [ ] Сравнить `baseSalary` из JSON-LD с видимым текстом
  - [ ] Детектировать "competitive salary" как red flag

### 1.4 Floating Banner UI
- [ ] Создать компонент `FloatingBanner.tsx`:
  - [ ] Использовать Shadow DOM для изоляции стилей
  - [ ] Позиционирование: fixed top, не перекрывает контент
  - [ ] Анимация появления (slide-in)

- [ ] Дизайн баннера:
  - [ ] Иконки: ⚠️ ⏰ 💰 🚩 ✅
  - [ ] Информация: возраст вакансии, скрытая ЗП, кол-во флагов
  - [ ] Кнопка "Analyze" для перехода в режим 2
  - [ ] Кнопка "X" для закрытия

- [ ] Коммуникация с Background Script:
  - [ ] Отправка собранных данных через `chrome.runtime.sendMessage`
  - [ ] Сохранение в `chrome.storage.local`

### 1.5 Тестирование Фазы 1
- [ ] Unit тесты для парсеров (Jest/Vitest)
- [ ] Интеграционные тесты на реальных страницах
- [ ] Тест на всех целевых сайтах

---

## 🤖 Фаза 2: Active Analysis (Режим "Decoder") — С AI

> **Приоритет**: HIGH | Core value proposition

### 2.1 Backend Proxy для LLM
- [ ] Создать `/backend` папку
- [ ] Настроить FastAPI или Express.js
- [ ] Endpoint `POST /api/analyze`:
  - [ ] Принимает: `{ jobText, hiddenData, resume }`
  - [ ] Валидация входных данных
  - [ ] Rate limiting per user
- [ ] Интеграция с OpenAI API:
  - [ ] Создать промпт-шаблон для анализа
  - [ ] Streaming response для лучшего UX
- [ ] Деплой на Vercel/Railway/Fly.io

### 2.2 Prompt Engineering
- [ ] Разработать System Prompt:
  ```
  You are "Job Decoder" — a sarcastic but helpful career advisor.
  Your job is to:
  1. Decode corporate bullshit in job postings
  2. Find hidden red flags
  3. Assess candidate-job compatibility
  4. Suggest resume improvements
  ```
- [ ] Структура ответа (JSON):
  ```json
  {
    "roast": "string — саркастичный разбор",
    "toxicityScore": 0-100,
    "compatibilityScore": 0-100,
    "redFlags": ["array of concerns"],
    "greenFlags": ["array of positives"],
    "gapAnalysis": {
      "missing": ["skills not in resume"],
      "suggestions": ["what to add"]
    },
    "interviewQuestions": ["3 questions to ask recruiter"]
  }
  ```
- [ ] Тестирование промптов на разных вакансиях,

### 2.3 Resume Storage
- [ ] Реализовать загрузку резюме:
  - [ ] Поддержка форматов: PDF, DOCX, TXT
  - [ ] Парсинг PDF (pdf-parse library)
  - [ ] Парсинг DOCX (mammoth library)
- [ ] Хранение в `chrome.storage.local`:
  - [ ] Текст резюме
  - [ ] Ключевые навыки (extracted)
  - [ ] Опыт работы (parsed)
- [ ] UI для загрузки в Settings/Onboarding

### 2.4 Analysis Panel UI
- [ ] Создать `AnalysisPanel.tsx` (SidePanel или Modal):
  - [ ] Кнопка "Analyze" с loading state
  - [ ] Отображение результатов:
    - [ ] Roast секция (стилизованная)
    - [ ] Score визуализация (gauge chart)
    - [ ] Flags таблица (red/green)
    - [ ] Gap Analysis секция
    - [ ] Interview Questions карточки
  - [ ] Кнопка "Tailor my Resume"

### 2.5 Тестирование Фазы 2
- [ ] Mock-тесты для LLM responses
- [ ] E2E тесты с реальными API вызовами
- [ ] Тест error handling (API down, rate limit)

---

## ✂️ Фаза 3: Tailor & Apply (Режим "Agent")

> **Приоритет**: MEDIUM | Value-add feature

### 3.1 Resume Tailor Logic
- [ ] Создать `ResumeTailor` класс:
  - [ ] Input: original resume + gap analysis + job keywords
  - [ ] Метод `tailorSummary()` — переписать Professional Summary
  - [ ] Метод `tailorBullets()` — улучшить Experience bullets
  - [ ] Метод `addKeywords()` — добавить ключевые слова

- [ ] LLM Prompt для tailoring:
  - [ ] Сохранить оригинальный "голос" кандидата
  - [ ] Интегрировать ключевые слова из вакансии
  - [ ] Не выдумывать опыт (только переформулировка)

### 3.2 Diff View UI
- [ ] Создать `DiffView.tsx` компонент:
  - [ ] Side-by-side: Original vs Tailored
  - [ ] Highlighting изменений (зеленый = добавлено, красный = удалено)
  - [ ] Возможность редактировать tailored версию
  - [ ] Кнопки: "Confirm" / "Revert" / "Edit"

### 3.3 Export Options
- [ ] Генерация PDF:
  - [ ] Использовать шаблон резюме (выбираемый)
  - [ ] Сохранить форматирование
  - [ ] Скачивание файла

- [ ] Copy to Clipboard:
  - [ ] Plain text
  - [ ] Formatted (HTML)

- [ ] Fill Form Assist (опционально):
  - [ ] Автозаполнение полей на сайтах

### 3.4 Тестирование Фазы 3
- [ ] Visual regression тесты для Diff View
- [ ] Тест генерации PDF
- [ ] Тест на разных форматах резюме

---

## 📊 Фаза 4: CRM & Tracking Dashboard

> **Приоритет**: MEDIUM | Retention feature

### 4.1 Database Setup (Supabase)
- [ ] Создать Supabase проект
- [ ] Схема таблиц:
  ```sql
  -- users
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMP
  );
  
  -- applications
  CREATE TABLE applications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    job_url TEXT,
    company_name TEXT,
    job_title TEXT,
    resume_snapshot TEXT,
    red_flags JSONB,
    green_flags JSONB,
    interview_questions JSONB,
    status TEXT DEFAULT 'applied',
    applied_at TIMESTAMP
  );
  ```
- [ ] Настроить Row Level Security (RLS)
- [ ] Создать API endpoints

### 4.2 Save & Apply Flow
- [ ] Реализовать `ApplicationTracker` сервис:
  - [ ] Метод `save(applicationData)`
  - [ ] Синхронизация: extension ↔ backend

- [ ] UI "Save & Apply" модал:
  - [ ] Превью: ссылка, компания, должность
  - [ ] Показать используемую версию резюме
  - [ ] Bullet points с flags
  - [ ] Кнопка подтверждения

### 4.3 Web Dashboard
- [ ] Создать `/dashboard` Next.js приложение:
  - [ ] Auth с Supabase (Google/Email)
  - [ ] Главная страница: таблица аппликаций
  - [ ] Фильтры: статус, дата, компания
  - [ ] Детали application: полный анализ
  - [ ] Статистика: кол-во откликов, success rate

- [ ] Функционал:
  - [ ] Изменение статуса (Applied → Interview → Offer/Rejected)
  - [ ] Reminder для follow-up
  - [ ] Export в CSV

### 4.4 Тестирование Фазы 4
- [ ] API тесты (CRUD operations)
- [ ] Auth flow тесты
- [ ] Dashboard E2E тесты (Playwright)

---

## 🚀 Фаза 5: Polish & Launch

### 5.1 UX Improvements
- [ ] Onboarding flow для новых пользователей
- [ ] Туториал/подсказки
- [ ] Dark mode
- [ ] Локализация (EN/RU)

### 5.2 Performance
- [ ] Lazy loading для тяжелых компонентов
- [ ] Кэширование LLM ответов
- [ ] Оптимизация bundle size

### 5.3 Security
- [ ] Audit API endpoints
- [ ] Sanitization user inputs
- [ ] Secure storage для API keys

### 5.4 Analytics
- [ ] Интегрировать Posthog/Mixpanel
- [ ] Трекать ключевые события:
  - [ ] Extension installed
  - [ ] Job analyzed
  - [ ] Resume tailored
  - [ ] Application saved

### 5.5 Launch
- [ ] Подготовить Chrome Web Store listing
- [ ] Screenshots и promo видео
- [ ] Privacy Policy & Terms
- [ ] Publish extension
- [ ] Product Hunt launch?

---

## 📝 Технические Заметки

### Примерная Структура Проекта
```
/job-bodyguard
├── /extension           # Chrome Extension
│   ├── /src
│   │   ├── /background
│   │   ├── /content
│   │   ├── /popup
│   │   ├── /sidepanel
│   │   ├── /components
│   │   ├── /services
│   │   ├── /parsers
│   │   └── /utils
│   ├── manifest.json
│   └── vite.config.ts
│
├── /backend             # API Server
│   ├── /src
│   │   ├── /routes
│   │   ├── /services
│   │   └── /prompts
│   └── package.json
│
├── /dashboard           # Web Dashboard (Next.js)
│   ├── /app
│   ├── /components
│   └── package.json
│
├── /shared              # Shared types/utils
│   └── /types
│
└── README.md
```

### Оценка Времени
| Фаза | Оценка | Комментарий |
|------|--------|-------------|
| Фаза 0 | 1-2 дня | Планирование и настройка |
| Фаза 1 | 5-7 дней | Core парсинг, основная работа |
| Фаза 2 | 4-5 дней | AI интеграция |
| Фаза 3 | 3-4 дня | Tailoring |
| Фаза 4 | 5-7 дней | Dashboard полностью |
| Фаза 5 | 3-4 дня | Polish |
| **Итого** | **~4-5 недель** | При full-time работе |

---

## ⚡ Quick Start (Рекомендация)

1. **Начни с Фазы 1.1-1.4** — получи работающий парсер и баннер
2. **Сделай MVP без AI** — покажи скрытые данные
3. **Добавь AI (Фаза 2)** — это твой main value
4. **Dashboard в конце** — это retention, не acquisition

---

> 💡 **Совет**: Делай постепенно, тестируй на реальных вакансиях. LinkedIn меняет DOM часто — будь готов к поддержке парсеров.
