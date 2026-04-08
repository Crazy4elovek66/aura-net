# Aura.net

Aura.net это Next 16 + Supabase проект социальной статусной игры с профилями, aura economy, голосами, daily/streak-циклами, leaderboard, discover, achievements, spend-actions, notifications, referrals и special-card состояниями.

В репозитории уже есть минимальный слой для public-launch ops:

- `/admin` для live-метрик продукта, suspicious patterns, moderation state, failed notification delivery и последних системных событий
- moderation foundation через `profile_moderation_states`
- runtime observability через `ops_events`
- prelaunch technical check через `npm run prelaunch:check`

## Стек

- `next@16.2.1`
- `react@19.2.4`
- `@supabase/supabase-js`
- `@supabase/ssr`
- Telegram auth / Telegram bot delivery

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env.local` с обязательными переменными:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_TELEGRAM_BOT_NAME=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SITE_URL=
AURA_INTERNAL_CRON_SECRET=
```

3. Применить SQL schema / migrations в Supabase до запуска приложения.

4. Запустить dev server:

```bash
npm run dev
```

## Критичные DB / RPC зависимости

Aura.net зависит от того, что нужные объекты схемы Supabase существуют и актуальны. Перед запуском public-режима проверь, что эти пути в БД присутствуют:

- базовые profile/economy функции: `increment_aura`, `claim_daily_reward`, `apply_daily_decay`
- leaderboard/discover функции: `get_aura_leaderboard`, `get_growth_leaderboard`, `get_profile_leaderboard_context`, `get_hype_profiles`
- ops/admin функции: `is_platform_admin`, `set_profile_special_card`, `set_profile_moderation_state`
- notifications/referrals циклы: `enqueue_notification_event`, `sync_leaderboard_presence_event`, `emit_active_weekly_title_moments`, `activate_referral_if_eligible`, `bind_profile_referral`

Если любой из этих functions отсутствует в Supabase schema cache, API routes будут падать даже при успешном frontend build.

## Admin / ops

- `/admin` доступен только platform admins из `public.platform_admins`
- `/admin/preview` остаётся архивом/визуальным preview карточек
- moderation actions сейчас поддерживают:
  - limit / restore profile
  - hide / show в discover
  - hide / show в leaderboards

Текущее поведение для limited-profile:

- блокируется голосование
- блокируется claim daily reward
- блокируются spend-actions / boost purchases
- профиль скрывается из public check page для не-админов
- профиль фильтруется из discover и leaderboard payloads

## Notification ops

- внутренний queue drain route: `POST /api/internal/notifications/drain`
- необязательный header, если настроен `AURA_INTERNAL_CRON_SECRET`:

```http
x-aura-internal-secret: <AURA_INTERNAL_CRON_SECRET>
```

Delivery failures и важные runtime issues пишутся в `public.ops_events` и показываются в `/admin`.

## Технические проверки

```bash
npm run lint
npm run typecheck
npm run build
npm run prelaunch:check
```

`npm run prelaunch:check` последовательно запускает lint, typecheck и build, а затем напоминает о ручных smoke flows, которые всё ещё стоит проверить.

## Ручные smoke flows перед public-режимом

- Telegram auth -> создание профиля / setup
- загрузка profile page с votes, daily reward, spend-actions, discover, leaderboard
- vote flow: запись aura, transactions и side effects
- notification drain: успешная отправка или видимое падение
- `/admin`: загрузка и применение moderation actions к публичным поверхностям

## Примечания

- Проект намеренно не использует платные APM / admin tools.
- Observability хранится в БД и сделана production-minded, но остаётся лёгкой.
- Если меняешь route handlers или app structure, сначала читай соответствующие документы в `node_modules/next/dist/docs/`, потому что проект работает на Next 16.
