-- Safe sync migration for aura economy (2026-03-31)

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists last_decay_at timestamp with time zone not null default timezone('utc'::text, now());
alter table public.profiles add column if not exists daily_streak integer not null default 0;
alter table public.profiles add column if not exists last_reward_at timestamp with time zone;
alter table public.profiles add column if not exists ai_comment text;
alter table public.profiles add column if not exists telegram_user text;
alter table public.profiles add column if not exists is_nickname_selected boolean not null default false;

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

create table if not exists public.boosts (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists profiles_aura_points_idx on public.profiles (aura_points desc);
create index if not exists votes_target_vote_type_idx on public.votes (target_id, vote_type);
create index if not exists boosts_profile_expires_idx on public.boosts (profile_id, expires_at desc);
create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);

alter table public.boosts enable row level security;
alter table public.transactions enable row level security;

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

revoke execute on function public.increment_aura(uuid, integer) from anon;
grant execute on function public.increment_aura(uuid, integer) to authenticated;
grant execute on function public.increment_aura(uuid, integer) to service_role;

revoke execute on function public.apply_daily_decay(uuid) from anon;
grant execute on function public.apply_daily_decay(uuid) to authenticated;
grant execute on function public.apply_daily_decay(uuid) to service_role;

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
  foreach v_table in array array['transactions', 'boosts']
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
