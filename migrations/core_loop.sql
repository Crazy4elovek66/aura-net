-- 1. Обновляем таблицу профилей
alter table public.profiles 
add column if not exists last_decay_at timestamp with time zone default timezone('utc'::text, now()) not null,
add column if not exists ai_comment text;

-- 2. Обновляем таблицу голосов
alter table public.votes 
add column if not exists is_anonymous boolean default false;

-- 3. Создаем таблицу транзакций (лог трат ауры)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount integer not null, -- может быть отрицательным
  type text not null, -- 'tax', 'boost', 'decay', 'reward'
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Создаем таблицу бустов (для Oracle/Marketplace)
create table if not exists public.boosts (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Политики безопасности
alter table public.transactions enable row level security;
alter table public.boosts enable row level security;

create policy "Юзеры видят только свои транзакции" 
on public.transactions for select using (auth.uid() = user_id);

create policy "Бусты видны всем" 
on public.boosts for select using (true);

-- 6. Обновляем публикацию для Realtime
alter publication supabase_realtime add table public.transactions, public.boosts;
