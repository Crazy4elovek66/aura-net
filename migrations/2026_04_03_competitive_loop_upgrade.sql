-- Competitive loop upgrade: live leaderboard, discover foundation, weekly titles and notification events (2026-04-03)

create table if not exists public.weekly_titles_catalog (
  key text primary key,
  title text not null,
  description text not null,
  icon text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

insert into public.weekly_titles_catalog (key, title, description, icon, is_active)
values
  ('weekly_aura_champion', 'Чемп ауры', 'Лидер недели по общей ауре.', 'CROWN', true),
  ('weekly_rise_rocket', 'Ракета роста', 'Самый быстрый рост ауры за 7 дней.', 'ROCKET', true),
  ('weekly_hype_pulse', 'Пульс хайпа', 'Самый обсуждаемый профиль недели.', 'PULSE', true)
on conflict (key) do update
set title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    is_active = excluded.is_active;

create table if not exists public.profile_weekly_titles (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  title_key text references public.weekly_titles_catalog(key) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  assigned_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (title_key, week_start),
  unique (profile_id, title_key, week_start)
);

create index if not exists profile_weekly_titles_active_idx
  on public.profile_weekly_titles (is_active, week_end desc);

create index if not exists profile_weekly_titles_profile_idx
  on public.profile_weekly_titles (profile_id, assigned_at desc);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  telegram_enabled boolean not null default true,
  notify_new_vote boolean not null default true,
  notify_aura_change boolean not null default true,
  notify_streak boolean not null default true,
  notify_leaderboard boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.notification_events (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  channel text not null default 'telegram' check (channel in ('telegram')),
  event_type text not null,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  error_message text,
  scheduled_for timestamp with time zone not null default timezone('utc'::text, now()),
  processed_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists notification_events_channel_dedupe_idx
  on public.notification_events (channel, dedupe_key)
  where dedupe_key is not null;

create index if not exists notification_events_queue_idx
  on public.notification_events (status, scheduled_for asc, created_at asc);

create index if not exists notification_events_profile_idx
  on public.notification_events (profile_id, created_at desc);

create table if not exists public.leaderboard_presence_states (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_rank bigint,
  in_top10 boolean not null default false,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists leaderboard_presence_states_top_idx
  on public.leaderboard_presence_states (in_top10, updated_at desc);

alter table public.weekly_titles_catalog enable row level security;
alter table public.profile_weekly_titles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.leaderboard_presence_states enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'weekly_titles_catalog' and policyname = 'weekly_titles_catalog_select_all'
  ) then
    create policy weekly_titles_catalog_select_all on public.weekly_titles_catalog
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'profile_weekly_titles' and policyname = 'profile_weekly_titles_select_all'
  ) then
    create policy profile_weekly_titles_select_all on public.profile_weekly_titles
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_select_own'
  ) then
    create policy notification_preferences_select_own on public.notification_preferences
      for select
      using (auth.uid() = profile_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_insert_own'
  ) then
    create policy notification_preferences_insert_own on public.notification_preferences
      for insert
      with check (auth.uid() = profile_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_update_own'
  ) then
    create policy notification_preferences_update_own on public.notification_preferences
      for update
      using (auth.uid() = profile_id)
      with check (auth.uid() = profile_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'notification_events' and policyname = 'notification_events_select_own'
  ) then
    create policy notification_events_select_own on public.notification_events
      for select
      using (auth.uid() = profile_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'leaderboard_presence_states' and policyname = 'leaderboard_presence_states_select_own'
  ) then
    create policy leaderboard_presence_states_select_own on public.leaderboard_presence_states
      for select
      using (auth.uid() = profile_id);
  end if;
end $$;

create or replace function public.get_aura_leaderboard(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  rank_position bigint,
  profile_id uuid,
  username text,
  display_name text,
  aura_points integer
)
language sql
security definer
stable
set search_path = public
as $$
  with ranked as (
    select
      p.id,
      p.username,
      p.display_name,
      p.aura_points,
      row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  )
  select
    r.rank_position,
    r.id as profile_id,
    r.username,
    coalesce(r.display_name, r.username) as display_name,
    r.aura_points
  from ranked r
  order by r.rank_position
  offset greatest(coalesce(p_offset, 0), 0)
  limit greatest(coalesce(p_limit, 20), 1);
$$;

create or replace function public.get_profile_leaderboard_context(
  p_profile_id uuid,
  p_top_target integer default 10
)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  aura_points integer,
  rank_position bigint,
  distance_to_next integer,
  distance_to_top_target integer,
  above_profile_id uuid,
  above_username text,
  above_display_name text,
  above_aura_points integer,
  below_profile_id uuid,
  below_username text,
  below_display_name text,
  below_aura_points integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_top_target integer := greatest(coalesce(p_top_target, 10), 1);
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to read leaderboard context for another profile';
    end if;
  end if;

  return query
  with ranked as (
    select
      p.id,
      p.username,
      coalesce(p.display_name, p.username) as display_name,
      p.aura_points,
      row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  ),
  me as (
    select *
    from ranked
    where id = p_profile_id
  ),
  above_me as (
    select *
    from ranked
    where rank_position = (select rank_position - 1 from me)
  ),
  below_me as (
    select *
    from ranked
    where rank_position = (select rank_position + 1 from me)
  ),
  top_target as (
    select *
    from ranked
    where rank_position = v_top_target
  )
  select
    me.id as profile_id,
    me.username,
    me.display_name,
    me.aura_points,
    me.rank_position,
    case
      when above_me.id is null then 0
      else greatest((above_me.aura_points - me.aura_points) + 1, 1)
    end as distance_to_next,
    case
      when me.rank_position <= v_top_target then 0
      when top_target.id is null then 0
      else greatest((top_target.aura_points - me.aura_points) + 1, 0)
    end as distance_to_top_target,
    above_me.id as above_profile_id,
    above_me.username as above_username,
    above_me.display_name as above_display_name,
    above_me.aura_points as above_aura_points,
    below_me.id as below_profile_id,
    below_me.username as below_username,
    below_me.display_name as below_display_name,
    below_me.aura_points as below_aura_points
  from me
  left join above_me on true
  left join below_me on true
  left join top_target on true;
end;
$$;

create or replace function public.enqueue_notification_event(
  p_profile_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_channel text default 'telegram',
  p_scheduled_for timestamp with time zone default timezone('utc'::text, now())
)
returns table (
  enqueued boolean,
  event_id uuid,
  status text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pref public.notification_preferences%rowtype;
  v_event_id uuid;
  v_channel text := coalesce(nullif(btrim(coalesce(p_channel, '')), ''), 'telegram');
  v_dedupe_key text := nullif(btrim(coalesce(p_dedupe_key, '')), '');
  v_status text := 'pending';
  v_reason text := 'queued';
  v_allowed boolean := true;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception 'Event type is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to enqueue event for another profile';
    end if;
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  insert into public.notification_preferences (profile_id)
  values (p_profile_id)
  on conflict (profile_id) do nothing;

  select *
  into v_pref
  from public.notification_preferences np
  where np.profile_id = p_profile_id;

  if v_channel <> 'telegram' then
    raise exception 'Unsupported channel: %', v_channel;
  end if;

  if not coalesce(v_pref.telegram_enabled, true) then
    v_allowed := false;
    v_status := 'skipped';
    v_reason := 'telegram_disabled';
  elsif coalesce(nullif(btrim(coalesce(v_profile.telegram_user, '')), ''), '') = '' then
    v_allowed := false;
    v_status := 'skipped';
    v_reason := 'telegram_username_missing';
  end if;

  if v_allowed then
    if p_event_type = 'new_vote' and not coalesce(v_pref.notify_new_vote, true) then
      v_allowed := false;
      v_status := 'skipped';
      v_reason := 'new_vote_disabled';
    elsif p_event_type = 'aura_changed' and not coalesce(v_pref.notify_aura_change, true) then
      v_allowed := false;
      v_status := 'skipped';
      v_reason := 'aura_disabled';
    elsif p_event_type = 'streak_reminder' and not coalesce(v_pref.notify_streak, true) then
      v_allowed := false;
      v_status := 'skipped';
      v_reason := 'streak_disabled';
    elsif p_event_type in ('leaderboard_top10_entered', 'leaderboard_top10_dropped') and not coalesce(v_pref.notify_leaderboard, true) then
      v_allowed := false;
      v_status := 'skipped';
      v_reason := 'leaderboard_disabled';
    end if;
  end if;

  insert into public.notification_events (
    profile_id,
    channel,
    event_type,
    dedupe_key,
    payload,
    status,
    scheduled_for
  )
  values (
    p_profile_id,
    v_channel,
    p_event_type,
    v_dedupe_key,
    coalesce(p_payload, '{}'::jsonb),
    v_status,
    coalesce(p_scheduled_for, timezone('utc'::text, now()))
  )
  on conflict (channel, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query
      select false, null::uuid, 'skipped'::text, 'duplicate_dedupe_key'::text;
    return;
  end if;

  return query
    select true, v_event_id, v_status, v_reason;
end;
$$;

create or replace function public.sync_leaderboard_presence_event(
  p_profile_id uuid
)
returns table (
  rank_position bigint,
  in_top10 boolean,
  entered_top10 boolean,
  dropped_from_top10 boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank bigint;
  v_in_top10 boolean;
  v_prev_in_top10 boolean := false;
  v_prev_rank bigint;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to sync leaderboard state for another profile';
    end if;
  end if;

  with ranked as (
    select
      p.id,
      row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  )
  select r.rank_position
  into v_rank
  from ranked r
  where r.id = p_profile_id;

  if v_rank is null then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  v_in_top10 := v_rank <= 10;

  select lps.in_top10, lps.last_rank
  into v_prev_in_top10, v_prev_rank
  from public.leaderboard_presence_states lps
  where lps.profile_id = p_profile_id;

  if not found then
    v_prev_in_top10 := false;
    v_prev_rank := null;
  end if;

  insert into public.leaderboard_presence_states (profile_id, last_rank, in_top10, updated_at)
  values (p_profile_id, v_rank, v_in_top10, timezone('utc'::text, now()))
  on conflict (profile_id) do update
  set last_rank = excluded.last_rank,
      in_top10 = excluded.in_top10,
      updated_at = excluded.updated_at;

  if v_in_top10 and not coalesce(v_prev_in_top10, false) then
    perform 1
    from public.enqueue_notification_event(
      p_profile_id,
      'leaderboard_top10_entered',
      jsonb_build_object(
        'rank', v_rank,
        'previousRank', v_prev_rank
      ),
      null,
      'telegram'
    );
  elsif not v_in_top10 and coalesce(v_prev_in_top10, false) then
    perform 1
    from public.enqueue_notification_event(
      p_profile_id,
      'leaderboard_top10_dropped',
      jsonb_build_object(
        'rank', v_rank,
        'previousRank', v_prev_rank
      ),
      null,
      'telegram'
    );
  end if;

  return query
    select v_rank, v_in_top10, (v_in_top10 and not coalesce(v_prev_in_top10, false)), (not v_in_top10 and coalesce(v_prev_in_top10, false));
end;
$$;

create or replace function public.refresh_weekly_titles(
  p_reference timestamp with time zone default timezone('utc'::text, now())
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference timestamp with time zone := coalesce(p_reference, timezone('utc'::text, now()));
  v_week_start date := (date_trunc('week', timezone('utc'::text, v_reference)) at time zone 'utc')::date;
  v_week_end date := ((date_trunc('week', timezone('utc'::text, v_reference)) + interval '7 day') at time zone 'utc')::date;
  v_aura_leader_id uuid;
  v_aura_score integer;
  v_growth_leader_id uuid;
  v_growth_score integer;
  v_hype_leader_id uuid;
  v_hype_score integer;
begin
  update public.profile_weekly_titles
  set is_active = false
  where is_active = true
    and week_end <= ((timezone('utc'::text, now())) at time zone 'utc')::date;

  delete from public.profile_weekly_titles
  where week_start = v_week_start;

  select p.id, p.aura_points
  into v_aura_leader_id, v_aura_score
  from public.profiles p
  order by p.aura_points desc, p.created_at asc, p.id asc
  limit 1;

  if v_aura_leader_id is not null then
    insert into public.profile_weekly_titles (
      profile_id,
      title_key,
      week_start,
      week_end,
      score,
      metadata,
      is_active
    )
    values (
      v_aura_leader_id,
      'weekly_aura_champion',
      v_week_start,
      v_week_end,
      coalesce(v_aura_score, 0),
      jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'aura_points'),
      true
    )
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id,
        week_end = excluded.week_end,
        score = excluded.score,
        metadata = excluded.metadata,
        is_active = true,
        assigned_at = timezone('utc'::text, now());
  end if;

  select g.user_id, g.growth_points
  into v_growth_leader_id, v_growth_score
  from public.get_growth_leaderboard(7, 1) g
  order by g.growth_points desc
  limit 1;

  if v_growth_leader_id is not null and coalesce(v_growth_score, 0) > 0 then
    insert into public.profile_weekly_titles (
      profile_id,
      title_key,
      week_start,
      week_end,
      score,
      metadata,
      is_active
    )
    values (
      v_growth_leader_id,
      'weekly_rise_rocket',
      v_week_start,
      v_week_end,
      coalesce(v_growth_score, 0),
      jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'growth_7d'),
      true
    )
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id,
        week_end = excluded.week_end,
        score = excluded.score,
        metadata = excluded.metadata,
        is_active = true,
        assigned_at = timezone('utc'::text, now());
  end if;

  with votes_7d as (
    select
      v.target_id,
      count(*)::integer as votes_count
    from public.votes v
    where v.created_at >= timezone('utc'::text, now()) - interval '7 day'
    group by v.target_id
  )
  select q.target_id, q.votes_count
  into v_hype_leader_id, v_hype_score
  from votes_7d q
  order by q.votes_count desc, q.target_id asc
  limit 1;

  if v_hype_leader_id is not null and coalesce(v_hype_score, 0) > 0 then
    insert into public.profile_weekly_titles (
      profile_id,
      title_key,
      week_start,
      week_end,
      score,
      metadata,
      is_active
    )
    values (
      v_hype_leader_id,
      'weekly_hype_pulse',
      v_week_start,
      v_week_end,
      coalesce(v_hype_score, 0),
      jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'votes_7d'),
      true
    )
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id,
        week_end = excluded.week_end,
        score = excluded.score,
        metadata = excluded.metadata,
        is_active = true,
        assigned_at = timezone('utc'::text, now());
  end if;
end;
$$;

create or replace function public.get_active_weekly_titles(
  p_limit integer default 12
)
returns table (
  title_key text,
  title text,
  description text,
  icon text,
  profile_id uuid,
  username text,
  display_name text,
  aura_points integer,
  score integer,
  week_start date,
  week_end date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    pwt.title_key,
    wtc.title,
    wtc.description,
    wtc.icon,
    p.id as profile_id,
    p.username,
    coalesce(p.display_name, p.username) as display_name,
    p.aura_points,
    pwt.score,
    pwt.week_start,
    pwt.week_end
  from public.profile_weekly_titles pwt
  join public.weekly_titles_catalog wtc on wtc.key = pwt.title_key
  join public.profiles p on p.id = pwt.profile_id
  where pwt.is_active = true
    and pwt.week_end > ((timezone('utc'::text, now())) at time zone 'utc')::date
  order by pwt.assigned_at desc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

create or replace function public.get_hype_profiles(
  p_hours integer default 24,
  p_limit integer default 12
)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  aura_points integer,
  votes_total integer,
  votes_up integer,
  votes_down integer,
  net_votes integer
)
language sql
security definer
stable
set search_path = public
as $$
  with votes_window as (
    select
      v.target_id,
      count(*)::integer as votes_total,
      count(*) filter (where v.vote_type = 'up')::integer as votes_up,
      count(*) filter (where v.vote_type = 'down')::integer as votes_down
    from public.votes v
    where v.created_at >= timezone('utc'::text, now()) - make_interval(hours => greatest(coalesce(p_hours, 24), 1))
    group by v.target_id
  )
  select
    p.id as profile_id,
    p.username,
    coalesce(p.display_name, p.username) as display_name,
    p.aura_points,
    vw.votes_total,
    vw.votes_up,
    vw.votes_down,
    (vw.votes_up - vw.votes_down) as net_votes
  from votes_window vw
  join public.profiles p on p.id = vw.target_id
  order by vw.votes_total desc, (vw.votes_up - vw.votes_down) desc, p.aura_points desc, p.created_at asc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

revoke execute on function public.get_aura_leaderboard(integer, integer) from anon;
grant execute on function public.get_aura_leaderboard(integer, integer) to authenticated;
grant execute on function public.get_aura_leaderboard(integer, integer) to service_role;

revoke execute on function public.get_profile_leaderboard_context(uuid, integer) from anon;
grant execute on function public.get_profile_leaderboard_context(uuid, integer) to authenticated;
grant execute on function public.get_profile_leaderboard_context(uuid, integer) to service_role;

revoke execute on function public.enqueue_notification_event(uuid, text, jsonb, text, text, timestamp with time zone) from anon;
grant execute on function public.enqueue_notification_event(uuid, text, jsonb, text, text, timestamp with time zone) to authenticated;
grant execute on function public.enqueue_notification_event(uuid, text, jsonb, text, text, timestamp with time zone) to service_role;

revoke execute on function public.sync_leaderboard_presence_event(uuid) from anon;
grant execute on function public.sync_leaderboard_presence_event(uuid) to authenticated;
grant execute on function public.sync_leaderboard_presence_event(uuid) to service_role;

revoke execute on function public.refresh_weekly_titles(timestamp with time zone) from anon;
revoke execute on function public.refresh_weekly_titles(timestamp with time zone) from authenticated;
grant execute on function public.refresh_weekly_titles(timestamp with time zone) to service_role;

revoke execute on function public.get_active_weekly_titles(integer) from anon;
grant execute on function public.get_active_weekly_titles(integer) to authenticated;
grant execute on function public.get_active_weekly_titles(integer) to service_role;

revoke execute on function public.get_hype_profiles(integer, integer) from anon;
grant execute on function public.get_hype_profiles(integer, integer) to authenticated;
grant execute on function public.get_hype_profiles(integer, integer) to service_role;

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
  foreach v_table in array array[
    'profile_weekly_titles',
    'notification_events',
    'notification_preferences',
    'leaderboard_presence_states'
  ]
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

