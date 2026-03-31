# Aura.net Project Manifest

## 📝 Основная информация
**Название:** Aura.net
**Тип проекта:** Социальная репутационная платформа (Loyalty/Reputation system).
**Платформа:** Telegram Mini App (TMA).
**Концепция:** Пользователи создают анкеты-карточки, копят "Ауру" (очки), голосуют друг за друга и продвигаются по тирам (NPC → SIGMA).

---

## 🛠 Технологический стек
- **Framework:** [Next.js 16.2.1](file:///package.json) (App Router, React 19)
- **Styling:** [Tailwind CSS 4](file:///package.json)
- **Animations:** [Framer Motion 12](file:///package.json)
- **Database / Auth:** [Supabase](file:///schema.sql) (PostgreSQL, RLS)
- **AI Engine:** Local Autonomous (Randomized Sarcasm) - *Groq SDK removed for Vercel stability*
- **Integration:** Telegram Web Apps API (`@twa-dev/sdk`)

---

## 📂 Структура проекта
- [`app/`](file:///app) — Основные роуты и API.
  - `/check/[username]` — Публичный просмотр чужой карточки.
  - `/profile` — Настройки и управление своим профилем.
  - `/api/vote` — Логика голосования (Up/Down) с автономными ИИ-комментариями.
  - `/api/boost` — Система буста карточек.
  - `proxy.ts` — Прокси-слой для сессий (бывший middleware.ts).
- [`components/`](file:///components) — UI-компоненты.
  - `UniversalCreatorCard.tsx` — **ГЛАВНЫЙ компонент**. Визуализация карточки со всеми тирами.
  - `AuraCard.tsx` — Обертка с логикой данных и оверлеями (Auth, BurnLog). Оптимизирована для гидрации.
  - `BurnLog.tsx` — Список тех, кто "сжигал" ауру.
- [`lib/`](file:///lib) — Бизнес-логика и хелперы.
  - `aura.ts` — Правила расчета тиров и эмодзи.
  - `decay.ts` — Система ежедневного распада (уменьшения) очков Ауры.

---

## 💎 Система Aura (Тиры)
Логика описана в [`lib/aura.ts`](file:///lib/aura.ts).
- **NPC (НПС):** <= 500 pts. (Эмодзи: 🤡).
- **HERO (ГЕРОЙ):** 501 - 2000 pts. (Эмодзи: 🤠).
- **THAT_ONE (ТОТ САМЫЙ):** 2001 - 5000 pts. (Эмодзи: 😏).
- **SIGMA (СИГМА):** > 5001 pts. (Эмодзи: 👑/🏆).

---

## 🗄 База данных (Supabase)
Структура описана в [`schema.sql`](file:///schema.sql).
### Таблица `profiles`
| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `id` | uuid | PK, связь с auth.users |
| `username` | text | Уникальный никнейм |
| `aura_points`| int | Текущие очки (default 100) |
| `telegram_user`| text | Данные из Telegram |

### Таблица `votes`
Служит для фиксации голосов (Up/Down) и предотвращения повторного голосования (Unique pair: `voter_id`, `target_id`).

---

## 🤖 Правила для ИИ
1. **Визуал превыше всего:** Используй сочные градиенты (`neon-purple`, `sigma-gold`), блюр (`backdrop-blur-3xl`) и плавные анимации `framer-motion`.
2. **TypeScript:** Строгая типизация обязательна (см. [`lib/types.ts`](file:///lib/types.ts)).
3. **Tailwind 4:** Используй современные CSS-переменные и директивы Tailwind 4.
4. **Коммуникация:** Отвечай на Русском языке, обращайся к пользователю "Илья", используй дружелюбный и экспертный тон.
5. **Безопасность:** Всегда учитывай RLS (Row Level Security) при работе с Supabase.

---
*Документ подготовлен AI-ассистентом Antigravity (2026).*
