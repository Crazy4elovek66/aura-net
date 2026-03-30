# AURA.NET Project Structure

aura-net/
├── app/
│   ├── (auth)/             # Авторизация (Supabase Auth)
│   │   └── login/page.tsx
│   ├── (dashboard)/        # Защищенные роуты
│   │   ├── profile/page.tsx
│   │   └── settings/page.tsx
│   ├── check/[username]/   # Публичная страница голосования (виральная)
│   │   └── page.tsx
│   ├── api/                # Backend API
│   │   ├── vote/route.ts   # Обработка +/- голосов
│   │   ├── og/route.ts     # Генерация динамических карточек (Satori)
│   │   └── ai-comment/route.ts # Ироничные ответы Llama 3
│   └── page.tsx            # Главная (Landing)
├── components/
│   ├── ui/                 # Атомарные компоненты (Neon Style)
│   ├── AuraCard.tsx        # Главный визуальный блок профиля
│   ├── VoteButtons.tsx     # Механика голосования
│   └── ShareButton.tsx     # Кнопка "В сторис" (html-to-image)
├── lib/
│   ├── supabase.ts         # Клиент базы данных
│   ├── utils.ts            # Логика расчета тиров (NPC/User/Sigma)
│   └── types.ts            # TS интерфейсы