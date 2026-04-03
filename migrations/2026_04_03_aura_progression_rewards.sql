-- Aura progression expansion: streak milestones, weekly activity rewards and achievements foundation (2026-04-03)

create table if not exists public.reward_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_key text not null,
  event_scope text not null default 'global',
  reward integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (user_id, event_key, event_scope)
);

create index if not exists reward_events_user_created_idx on public.reward_events (user_id, created_at desc);

create table if not exists public.achievements_catalog (
  key text primary key,
  title text not null,
  description text not null,
  reward integer not null default 0 check (reward >= 0),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_key text references public.achievements_catalog(key) on delete cascade not null,
  unlocked_at timestamp with time zone not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, achievement_key)
);

create index if not exists user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc);

alter table public.reward_events enable row level security;
alter table public.achievements_catalog enable row level security;
alter table public.user_achievements enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'reward_events' and policyname = 'reward_events_select_own'
  ) then
    create policy reward_events_select_own on public.reward_events
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'achievements_catalog' and policyname = 'achievements_catalog_select_all'
  ) then
    create policy achievements_catalog_select_all on public.achievements_catalog
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'user_achievements' and policyname = 'user_achievements_select_own'
  ) then
    create policy user_achievements_select_own on public.user_achievements
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

insert into public.achievements_catalog (key, title, description, reward, is_active)
values
  ('streak_7_days_first', 'Железная серия: 7 дней', 'Впервые удержал серию 7 дней подряд.', 12, true),
  ('upvotes_received_10', 'Первые 10 плюс-голосов', 'Получил первые 10 +аура голосов от других людей.', 15, true),
  ('first_out_of_npc', 'Выход из НПС', 'Впервые вышел из тира НПС.', 0, true),
  ('aura_1000', 'Аура 1000', 'Впервые достиг 1000 очков ауры.', 0, true)
on conflict (key) do update
set title = excluded.title,
    description = excluded.description,
    reward = excluded.reward,
    is_active = excluded.is_active;

create or replace function public.grant_achievement(
  p_profile_id uuid,
  p_achievement_key text,
  p_context jsonb default '{}'::jsonb
)
returns table (
  granted boolean,
  reward integer,
  title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_achievement public.achievements_catalog%rowtype;
  v_inserted_id uuid;
  v_reward integer;
  v_previous_aura integer;
  v_current_aura integer;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  select *
  into v_achievement
  from public.achievements_catalog c
  where c.key = p_achievement_key
    and c.is_active = true;

  if not found then
    return query
      select false, 0, null::text;
    return;
  end if;

  insert into public.user_achievements (user_id, achievement_key, metadata)
  values (
    p_profile_id,
    v_achievement.key,
    coalesce(p_context, '{}'::jsonb)
  )
  on conflict (user_id, achievement_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query
      select false, 0, v_achievement.title;
    return;
  end if;

  v_reward := greatest(coalesce(v_achievement.reward, 0), 0);

  if v_reward > 0 then
    select p.aura_points
    into v_previous_aura
    from public.profiles p
    where p.id = p_profile_id
    for update;

    if not found then
      raise exception 'Profile not found for id %', p_profile_id;
    end if;

    update public.profiles
    set aura_points = aura_points + v_reward
    where id = p_profile_id
    returning aura_points into v_current_aura;

    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_profile_id,
      v_reward,
      'achievement_reward',
      format('Награда за достижение: %s', v_achievement.title),
      jsonb_build_object(
        'source', 'achievement',
        'achievementKey', v_achievement.key,
        'achievementTitle', v_achievement.title,
        'reward', v_reward,
        'context', coalesce(p_context, '{}'::jsonb),
        'auraBefore', v_previous_aura,
        'auraAfter', v_current_aura
      )
    );
  end if;

  return query
    select true, v_reward, v_achievement.title;
end;
$$;

create or replace function public.process_profile_progression(
  p_profile_id uuid,
  p_previous_aura integer,
  p_current_aura integer,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then
    return;
  end if;

  if coalesce(p_previous_aura, 0) < 501 and coalesce(p_current_aura, 0) >= 501 then
    perform 1
    from public.grant_achievement(
      p_profile_id,
      'first_out_of_npc',
      coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
        'source', 'profile_progression',
        'threshold', 501,
        'fromAura', coalesce(p_previous_aura, 0),
        'toAura', coalesce(p_current_aura, 0)
      )
    );
  end if;

  if coalesce(p_previous_aura, 0) < 1000 and coalesce(p_current_aura, 0) >= 1000 then
    perform 1
    from public.grant_achievement(
      p_profile_id,
      'aura_1000',
      coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
        'source', 'profile_progression',
        'threshold', 1000,
        'fromAura', coalesce(p_previous_aura, 0),
        'toAura', coalesce(p_current_aura, 0)
      )
    );
  end if;
end;
$$;

create or replace function public.grant_event_reward_once(
  p_profile_id uuid,
  p_event_key text,
  p_event_scope text default 'global',
  p_reward integer default 0,
  p_transaction_type text default 'event_reward',
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  granted boolean,
  reward integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_scope text := coalesce(nullif(btrim(coalesce(p_event_scope, '')), ''), 'global');
  v_event_id uuid;
  v_reward integer := greatest(coalesce(p_reward, 0), 0);
  v_previous_aura integer;
  v_current_aura integer;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if nullif(btrim(coalesce(p_event_key, '')), '') is null then
    raise exception 'Event key is required';
  end if;

  insert into public.reward_events (user_id, event_key, event_scope, reward, metadata)
  values (
    p_profile_id,
    p_event_key,
    v_event_scope,
    v_reward,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, event_key, event_scope) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query
      select false, 0;
    return;
  end if;

  if v_reward > 0 then
    select p.aura_points
    into v_previous_aura
    from public.profiles p
    where p.id = p_profile_id
    for update;

    if not found then
      raise exception 'Profile not found for id %', p_profile_id;
    end if;

    update public.profiles
    set aura_points = aura_points + v_reward
    where id = p_profile_id
    returning aura_points into v_current_aura;

    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_profile_id,
      v_reward,
      coalesce(nullif(btrim(coalesce(p_transaction_type, '')), ''), 'event_reward'),
      coalesce(nullif(btrim(coalesce(p_description, '')), ''), format('Награда за событие: %s', p_event_key)),
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'event_reward',
        'eventKey', p_event_key,
        'eventScope', v_event_scope,
        'reward', v_reward,
        'auraBefore', v_previous_aura,
        'auraAfter', v_current_aura
      )
    );

    perform public.process_profile_progression(
      p_profile_id,
      v_previous_aura,
      v_current_aura,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'event_reward',
        'eventKey', p_event_key,
        'eventScope', v_event_scope,
        'trigger', 'grant_event_reward_once'
      )
    );
  end if;

  return query
    select true, v_reward;
end;
$$;

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

  if v_next_aura > v_current_aura then
    perform public.process_profile_progression(
      target_id,
      v_current_aura,
      v_next_aura,
      jsonb_build_object(
        'source', 'increment_aura',
        'delta', amount
      )
    );
  end if;
end;
$$;

drop function if exists public.claim_daily_reward(uuid);

create function public.claim_daily_reward(p_profile_id uuid)
returns table (
  claimed boolean,
  reward integer,
  streak integer,
  next_reward integer,
  last_reward_at timestamp with time zone,
  available_at timestamp with time zone,
  base_reward integer,
  bonus_reward integer,
  streak_milestone_reward integer,
  weekly_reward integer,
  achievement_reward integer,
  unlocked_achievements text[]
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
  v_last_reward_at timestamp with time zone;
  v_streak integer;
  v_base_reward integer;
  v_next_reward integer;
  v_available_at timestamp with time zone;
  v_aura_before integer;
  v_aura_after integer;
  v_streak_bonus integer := 0;
  v_weekly_bonus integer := 0;
  v_achievement_bonus integer := 0;
  v_bonus_total integer := 0;
  v_total_reward integer := 0;
  v_unlocked_achievements text[] := array[]::text[];
  v_milestones integer[] := array[3, 7, 14, 30];
  v_milestone_rewards integer[] := array[5, 10, 20, 40];
  v_index integer;
  v_granted boolean;
  v_reward_value integer;
  v_achievement_title text;
  v_week_start timestamp with time zone;
  v_week_end timestamp with time zone;
  v_week_scope text;
  v_weekly_active_days integer := 0;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to claim reward for another profile';
    end if;
  end if;

  select p.daily_streak, p.last_reward_at, p.aura_points
  into v_streak, v_previous_reward_at, v_aura_before
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
      select false, 0, greatest(v_streak, 0), v_next_reward, v_previous_reward_at, v_available_at, 0, 0, 0, 0, 0, array[]::text[];
    return;
  end if;

  if v_previous_reward_day = (v_today - 1) then
    v_streak := greatest(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  v_base_reward := least(20 + ((v_streak - 1) * 5), 50);
  v_next_reward := least(20 + (v_streak * 5), 50);
  v_available_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) + interval '1 day');

  update public.profiles
  set aura_points = aura_points + v_base_reward,
      daily_streak = v_streak,
      last_reward_at = v_now
  where id = p_profile_id
  returning public.profiles.last_reward_at, public.profiles.aura_points
  into v_last_reward_at, v_aura_after;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    v_base_reward,
    'daily_reward',
    format('Награда за серию: день %s', v_streak),
    jsonb_build_object(
      'source', 'daily_reward',
      'streak', v_streak,
      'reward', v_base_reward,
      'nextReward', v_next_reward
    )
  );

  perform public.process_profile_progression(
    p_profile_id,
    v_aura_before,
    v_aura_after,
    jsonb_build_object(
      'source', 'daily_reward',
      'streak', v_streak,
      'baseReward', v_base_reward
    )
  );

  for v_index in 1..array_length(v_milestones, 1) loop
    if v_streak >= v_milestones[v_index] then
      select e.granted, e.reward
      into v_granted, v_reward_value
      from public.grant_event_reward_once(
        p_profile_id,
        format('streak_milestone_%s', v_milestones[v_index]),
        'global',
        v_milestone_rewards[v_index],
        'streak_milestone',
        format('Награда за этап серии: %s дней', v_milestones[v_index]),
        jsonb_build_object(
          'source', 'streak_milestone',
          'milestoneDays', v_milestones[v_index],
          'streakAtClaim', v_streak,
          'reward', v_milestone_rewards[v_index]
        )
      ) e;

      if coalesce(v_granted, false) then
        v_streak_bonus := v_streak_bonus + coalesce(v_reward_value, 0);
      end if;
    end if;
  end loop;

  v_week_start := timezone('utc'::text, date_trunc('week', timezone('utc'::text, v_now)));
  v_week_end := v_week_start + interval '7 day';
  v_week_scope := ((v_week_start at time zone 'utc')::date)::text;

  select count(distinct ((t.created_at at time zone 'utc')::date))
  into v_weekly_active_days
  from public.transactions t
  where t.user_id = p_profile_id
    and t.type = 'daily_reward'
    and t.created_at >= v_week_start
    and t.created_at < v_week_end;

  if v_weekly_active_days >= 5 then
    select e.granted, e.reward
    into v_granted, v_reward_value
    from public.grant_event_reward_once(
      p_profile_id,
      'weekly_activity_5_days',
      v_week_scope,
      15,
      'weekly_activity_reward',
      format('Недельная награда за активность (%s/7 дней)', v_weekly_active_days),
      jsonb_build_object(
        'source', 'weekly_activity',
        'weekStart', v_week_scope,
        'activeDays', v_weekly_active_days,
        'requiredDays', 5,
        'reward', 15
      )
    ) e;

    if coalesce(v_granted, false) then
      v_weekly_bonus := v_weekly_bonus + coalesce(v_reward_value, 0);
    end if;
  end if;

  if v_streak >= 7 then
    select a.granted, a.reward, a.title
    into v_granted, v_reward_value, v_achievement_title
    from public.grant_achievement(
      p_profile_id,
      'streak_7_days_first',
      jsonb_build_object(
        'source', 'daily_reward',
        'streak', v_streak,
        'claimedAt', v_now
      )
    ) a;

    if coalesce(v_granted, false) then
      v_achievement_bonus := v_achievement_bonus + coalesce(v_reward_value, 0);

      if v_achievement_title is not null then
        v_unlocked_achievements := array_append(v_unlocked_achievements, v_achievement_title);
      end if;
    end if;
  end if;

  v_bonus_total := v_streak_bonus + v_weekly_bonus + v_achievement_bonus;
  v_total_reward := v_base_reward + v_bonus_total;

  return query
    select true, v_total_reward, v_streak, v_next_reward, v_last_reward_at, v_available_at, v_base_reward, v_bonus_total, v_streak_bonus, v_weekly_bonus, v_achievement_bonus, v_unlocked_achievements;
end;
$$;

revoke execute on function public.grant_achievement(uuid, text, jsonb) from public;
revoke execute on function public.grant_achievement(uuid, text, jsonb) from anon;
revoke execute on function public.grant_achievement(uuid, text, jsonb) from authenticated;
grant execute on function public.grant_achievement(uuid, text, jsonb) to service_role;

revoke execute on function public.process_profile_progression(uuid, integer, integer, jsonb) from public;
revoke execute on function public.process_profile_progression(uuid, integer, integer, jsonb) from anon;
revoke execute on function public.process_profile_progression(uuid, integer, integer, jsonb) from authenticated;
grant execute on function public.process_profile_progression(uuid, integer, integer, jsonb) to service_role;

revoke execute on function public.grant_event_reward_once(uuid, text, text, integer, text, text, jsonb) from public;
revoke execute on function public.grant_event_reward_once(uuid, text, text, integer, text, text, jsonb) from anon;
revoke execute on function public.grant_event_reward_once(uuid, text, text, integer, text, text, jsonb) from authenticated;
grant execute on function public.grant_event_reward_once(uuid, text, text, integer, text, text, jsonb) to service_role;

revoke execute on function public.claim_daily_reward(uuid) from anon;
grant execute on function public.claim_daily_reward(uuid) to authenticated;
grant execute on function public.claim_daily_reward(uuid) to service_role;

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
  foreach v_table in array array['reward_events', 'achievements_catalog', 'user_achievements']
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
