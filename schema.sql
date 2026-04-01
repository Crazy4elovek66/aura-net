create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  telegram_user text,
  status text,
  aura_points integer not null default 100,
  is_nickname_selected boolean not null default false,
  last_decay_at timestamp with time zone not null default timezone('utc'::text, now()),
  daily_streak integer not null default 0,
  last_reward_at timestamp with time zone,
  ai_comment text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists telegram_user text;
alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists aura_points integer not null default 100;
alter table public.profiles add column if not exists is_nickname_selected boolean not null default false;
alter table public.profiles add column if not exists last_decay_at timestamp with time zone not null default timezone('utc'::text, now());
alter table public.profiles add column if not exists daily_streak integer not null default 0;
alter table public.profiles add column if not exists last_reward_at timestamp with time zone;
alter table public.profiles add column if not exists ai_comment text;
alter table public.profiles add column if not exists created_at timestamp with time zone not null default timezone('utc'::text, now());

update public.profiles
set display_name = username
where display_name is null or btrim(display_name) = '';

create table if not exists public.votes (
  id uuid default gen_random_uuid() primary key,
  voter_id uuid references auth.users(id) on delete set null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  is_anonymous boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (voter_id, target_id)
);

alter table public.votes add column if not exists is_anonymous boolean not null default false;

create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount integer not null,
  type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.transactions add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.boosts (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists profiles_aura_points_idx on public.profiles (aura_points desc);
create index if not exists votes_target_vote_type_idx on public.votes (target_id, vote_type);
create index if not exists votes_target_created_idx on public.votes (target_id, created_at desc);
create index if not exists votes_voter_created_idx on public.votes (voter_id, created_at desc);
create index if not exists votes_voter_anon_created_idx on public.votes (voter_id, created_at desc) where is_anonymous = true;
create index if not exists boosts_profile_expires_idx on public.boosts (profile_id, expires_at desc);
create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists transactions_positive_created_idx on public.transactions (created_at desc) where amount > 0;

alter table public.profiles enable row level security;
alter table public.votes enable row level security;
alter table public.boosts enable row level security;
alter table public.transactions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_all'
  ) then
    create policy profiles_select_all on public.profiles
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'votes' and policyname = 'votes_select_all'
  ) then
    create policy votes_select_all on public.votes
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'votes' and policyname = 'votes_insert_own'
  ) then
    create policy votes_insert_own on public.votes
      for insert
      with check (auth.uid() = voter_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'boosts' and policyname = 'boosts_select_all'
  ) then
    create policy boosts_select_all on public.boosts
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'boosts' and policyname = 'boosts_insert_own'
  ) then
    create policy boosts_insert_own on public.boosts
      for insert
      with check (auth.uid() = profile_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_select_own'
  ) then
    create policy transactions_select_own on public.transactions
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_own'
  ) then
    create policy transactions_insert_own on public.transactions
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_username text;
  v_username text;
  v_suffix integer := 0;
begin
  if (new.raw_app_meta_data->>'is_anonymous')::boolean = true or new.email is null then
    return new;
  end if;

  v_base_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'user_' || substring(new.id::text from 1 for 8)
  );

  v_base_username := regexp_replace(v_base_username, '[[:space:]]+', '_', 'g');
  v_base_username := left(v_base_username, 20);

  if char_length(v_base_username) < 3 then
    v_base_username := 'user_' || substring(new.id::text from 1 for 8);
  end if;

  v_username := v_base_username;

  while exists (
    select 1
    from public.profiles p
    where p.username = v_username
      and p.id <> new.id
  ) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base_username, greatest(3, 20 - char_length(v_suffix::text) - 1)) || '_' || v_suffix::text;
  end loop;

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    telegram_user,
    is_nickname_selected
  )
  values (
    new.id,
    v_username,
    v_username,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    false
  )
  on conflict (id) do update
  set avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      telegram_user = coalesce(excluded.telegram_user, public.profiles.telegram_user);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row
  execute procedure public.handle_new_user();

create or replace function public.increment_aura(target_id uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_aura integer;
  v_next_aura integer;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;

    if auth.uid() <> target_id then
      raise exception 'Not allowed to change another profile aura';
    end if;

    if amount > 0 then
      raise exception 'Positive self aura changes are not allowed';
    end if;
  end if;

  select p.aura_points
  into v_current_aura
  from public.profiles p
  where p.id = target_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', target_id;
  end if;

  if auth.role() <> 'service_role' and amount < 0 and (v_current_aura + amount) < 0 then
    raise exception 'Insufficient aura';
  end if;

  if auth.role() = 'service_role' then
    v_next_aura := greatest(v_current_aura + amount, 0);
  else
    v_next_aura := v_current_aura + amount;
  end if;

  update public.profiles
  set aura_points = v_next_aura
  where id = target_id;
end;
$$;

create or replace function public.apply_daily_decay(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_aura integer;
  v_last_decay_at timestamp with time zone;
  v_days integer;
  v_new_aura integer;
  v_aura_to_lose integer;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to apply decay for another profile';
    end if;
  end if;

  select p.aura_points, p.last_decay_at
  into v_aura, v_last_decay_at
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    return 0;
  end if;

  if v_last_decay_at is null then
    update public.profiles
    set last_decay_at = v_now
    where id = p_profile_id;

    return 0;
  end if;

  v_days := floor(extract(epoch from (v_now - v_last_decay_at)) / 86400);

  if v_days < 1 then
    return 0;
  end if;

  v_new_aura := floor(v_aura * power(0.97::numeric, v_days));
  v_aura_to_lose := greatest(v_aura - v_new_aura, 0);

  update public.profiles
  set aura_points = greatest(aura_points - v_aura_to_lose, 0),
      last_decay_at = v_now
  where id = p_profile_id;

  if v_aura_to_lose > 0 then
    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_profile_id,
      -v_aura_to_lose,
      'decay',
      format('Угасание ауры: %s дн.', v_days),
      jsonb_build_object('daysPassed', v_days, 'ratePerDay', 0.03)
    );
  end if;

  return v_aura_to_lose;
end;
$$;

create or replace function public.claim_daily_reward(p_profile_id uuid)
returns table (
  claimed boolean,
  reward integer,
  streak integer,
  next_reward integer,
  last_reward_at timestamp with time zone,
  available_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_today date := (v_now at time zone 'utc')::date;
  v_previous_reward_at timestamp with time zone;
  v_previous_reward_day date;
  v_streak integer;
  v_reward integer;
  v_next_reward integer;
  v_available_at timestamp with time zone;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to claim reward for another profile';
    end if;
  end if;

  select p.daily_streak, p.last_reward_at
  into v_streak, v_previous_reward_at
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  v_streak := coalesce(v_streak, 0);

  if v_previous_reward_at is not null then
    v_previous_reward_day := (v_previous_reward_at at time zone 'utc')::date;
  end if;

  if v_previous_reward_day is not null and v_previous_reward_day >= v_today then
    v_available_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) + interval '1 day');
    v_next_reward := least(20 + (greatest(v_streak, 0) * 5), 50);

    return query
      select false, 0, greatest(v_streak, 0), v_next_reward, v_previous_reward_at, v_available_at;
    return;
  end if;

  if v_previous_reward_day = (v_today - 1) then
    v_streak := greatest(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  v_reward := least(20 + ((v_streak - 1) * 5), 50);
  v_next_reward := least(20 + (v_streak * 5), 50);
  v_available_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) + interval '1 day');

  update public.profiles
  set aura_points = greatest(aura_points + v_reward, 0),
      daily_streak = v_streak,
      last_reward_at = v_now
  where id = p_profile_id
  returning public.profiles.last_reward_at into v_previous_reward_at;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    v_reward,
    'daily_reward',
    format('Награда за серию: день %s', v_streak),
    jsonb_build_object(
      'source', 'daily_reward',
      'streak', v_streak,
      'reward', v_reward,
      'nextReward', v_next_reward
    )
  );

  return query
    select true, v_reward, v_streak, v_next_reward, v_previous_reward_at, v_available_at;
end;
$$;

create or replace function public.get_growth_leaderboard(p_days integer default 7, p_limit integer default 5)
returns table (
  user_id uuid,
  username text,
  display_name text,
  aura_points integer,
  growth_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(coalesce(p_days, 7), 1);
  v_limit integer := greatest(coalesce(p_limit, 5), 1);
  v_since timestamp with time zone := timezone('utc'::text, now()) - make_interval(days => v_days);
begin
  return query
    select
      p.id,
      p.username,
      coalesce(nullif(btrim(p.display_name), ''), p.username),
      p.aura_points,
      coalesce(sum(t.amount), 0)::integer as growth_points
    from public.transactions t
    join public.profiles p on p.id = t.user_id
    where t.amount > 0
      and t.created_at >= v_since
    group by p.id, p.username, p.display_name, p.aura_points, p.created_at
    order by growth_points desc, p.aura_points desc, p.created_at asc
    limit v_limit;
end;
$$;

revoke execute on function public.increment_aura(uuid, integer) from anon;
grant execute on function public.increment_aura(uuid, integer) to authenticated;
grant execute on function public.increment_aura(uuid, integer) to service_role;

revoke execute on function public.apply_daily_decay(uuid) from anon;
grant execute on function public.apply_daily_decay(uuid) to authenticated;
grant execute on function public.apply_daily_decay(uuid) to service_role;

revoke execute on function public.claim_daily_reward(uuid) from anon;
grant execute on function public.claim_daily_reward(uuid) to authenticated;
grant execute on function public.claim_daily_reward(uuid) to service_role;

revoke execute on function public.get_growth_leaderboard(integer, integer) from anon;
grant execute on function public.get_growth_leaderboard(integer, integer) to authenticated;
grant execute on function public.get_growth_leaderboard(integer, integer) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['profiles', 'votes', 'transactions', 'boosts']
  loop
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
