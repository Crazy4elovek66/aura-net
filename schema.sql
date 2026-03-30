-- 1. Таблица профилей
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
   avatar_url text,
   telegram_user text,
   aura_points integer default 100,
   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 );

-- Добавляем колонку если таблица уже создана
alter table public.profiles add column if not exists is_nickname_selected boolean default false;

-- Чистим старых "Гостей" - заменяем на ники (username) ПРЯМО СЕЙЧАС
update public.profiles set display_name = username where display_name = 'Гость' OR display_name IS NULL;

-- 2. Таблица голосов
create table if not exists public.votes (
  id uuid default gen_random_uuid() primary key,
  voter_id uuid references auth.users on delete set null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote_type text check (vote_type in ('up', 'down')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(voter_id, target_id)
);

-- 3. Включаем Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.votes enable row level security;

-- 4. Политики безопасности для Profiles
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Профили видны всем') then
    create policy "Профили видны всем" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Юзеры могут обновлять только свой профиль') then
    create policy "Юзеры могут обновлять только свой профиль" on public.profiles for update using (auth.uid() = id);
  end if;
end $$;

-- 5. Политики безопасности для Votes
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'votes' and policyname = 'Голоса видны всем') then
    create policy "Голоса видны всем" on public.votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'votes' and policyname = 'Авторизованные юзеры могут голосовать') then
    create policy "Авторизованные юзеры могут голосовать" on public.votes for insert with check (auth.uid() = voter_id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_username text;
begin
  -- Если профиль уже существует — ничего не делаем
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  -- Для анонимных юзеров профиль не создаем (у них нет email)
  if (new.raw_app_meta_data->>'is_anonymous')::boolean = true or (new.email is null) then
    return new;
  end if;

  v_username := coalesce(split_part(new.email, '@', 1), 'user') || '_' || floor(random() * 1000)::text;

  insert into public.profiles (id, username, display_name, avatar_url, is_nickname_selected, telegram_user)
  values (
    new.id, 
    v_username,
    v_username,
    new.raw_user_meta_data->>'avatar_url',
    false,
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 8. Включаем Realtime для таблиц
begin;
  -- Удаляем старую публикацию если есть
  drop publication if exists supabase_realtime;
  -- Создаем новую для нужных таблиц
  create publication supabase_realtime for table public.profiles, public.votes;
commit;


drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Функция для атомарного изменения очков ауры
create or replace function public.increment_aura(target_id uuid, amount integer)
returns void as $$
begin
  update public.profiles
  set aura_points = aura_points + amount
  where id = target_id;
end;
$$ language plpgsql security definer;
