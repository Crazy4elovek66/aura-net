-- 1. Добавляем колонку в таблицу профилей
alter table public.profiles add column if not exists telegram_user text;

-- 2. Обновляем существующие записи из метаданных auth.users
-- (Вытаскиваем оригинальный username Телеграма для всех текущих юзеров)
update public.profiles p
set telegram_user = u.raw_user_meta_data->>'username'
from auth.users u
where p.id = u.id and (p.telegram_user is null or p.telegram_user = '');

-- 3. Обновляем функцию триггера для автоматизации в будущем
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
