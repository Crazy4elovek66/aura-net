create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  telegram_user text,
  telegram_id bigint,
  status text,
  special_card text,
  aura_points integer not null default 100,
  is_nickname_selected boolean not null default false,
  last_decay_at timestamp with time zone not null default timezone('utc'::text, now()),
  daily_streak integer not null default 0,
  last_reward_at timestamp with time zone,
  last_streak_save_at timestamp with time zone,
  ai_comment text,
  invite_code text,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint profiles_special_card_check check (special_card is null or special_card in ('RESONANCE'))
);

create table if not exists public.votes (
  id uuid default gen_random_uuid() primary key,
  voter_id uuid references auth.users(id) on delete set null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  vote_type text not null check (vote_type in ('up', 'down')),
  is_anonymous boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (voter_id, target_id)
);

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

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.profile_moderation_states (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  is_limited boolean not null default false,
  hide_from_discover boolean not null default false,
  hide_from_leaderboards boolean not null default false,
  reason text,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.ops_events (
  id uuid default gen_random_uuid() primary key,
  level text not null default 'info' check (level in ('info', 'warn', 'error', 'critical')),
  scope text not null,
  event_type text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  request_path text,
  request_id text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.aura_effects (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  effect_type text not null check (effect_type in ('DECAY_SHIELD', 'CARD_ACCENT')),
  effect_variant text,
  starts_at timestamp with time zone not null default timezone('utc'::text, now()),
  expires_at timestamp with time zone not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

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

create table if not exists public.weekly_titles_catalog (
  key text primary key,
  title text not null,
  description text not null,
  icon text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

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
  attempts integer not null default 0,
  error_message text,
  last_error_code text,
  scheduled_for timestamp with time zone not null default timezone('utc'::text, now()),
  last_attempt_at timestamp with time zone,
  processing_started_at timestamp with time zone,
  processed_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.runtime_jobs (
  id uuid default gen_random_uuid() primary key,
  job_type text not null check (
    job_type in (
      'enqueue_notification_event',
      'sync_leaderboard_presence',
      'refresh_weekly_titles',
      'emit_weekly_title_moments',
      'activate_referral',
      'bind_referral'
    )
  ),
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  error_message text,
  last_error_code text,
  scheduled_for timestamp with time zone not null default timezone('utc'::text, now()),
  processing_started_at timestamp with time zone,
  processed_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.rate_limit_counters (
  bucket_key text primary key,
  window_started_at timestamp with time zone not null,
  window_ends_at timestamp with time zone not null,
  hits integer not null default 0,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.leaderboard_presence_states (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  last_rank bigint,
  in_top10 boolean not null default false,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.referrals (
  id uuid default gen_random_uuid() primary key,
  inviter_id uuid references public.profiles(id) on delete cascade not null,
  invitee_id uuid references public.profiles(id) on delete cascade not null,
  invite_code text not null,
  status text not null default 'pending' check (status in ('pending', 'activated', 'rejected')),
  joined_at timestamp with time zone not null default timezone('utc'::text, now()),
  activated_at timestamp with time zone,
  activation_source text,
  inviter_reward integer not null default 0,
  invitee_reward integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (invitee_id),
  unique (inviter_id, invitee_id)
);

create table if not exists public.shareable_moments (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  moment_type text not null,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  shared_at timestamp with time zone
);

update public.profiles
set display_name = username
where display_name is null or btrim(display_name) = '';

update public.profiles p
set telegram_id = nullif(u.raw_user_meta_data->>'telegram_id', '')::bigint
from auth.users u
where u.id = p.id
  and p.telegram_id is null
  and nullif(u.raw_user_meta_data->>'telegram_id', '') is not null;

insert into public.platform_admins (user_id)
select p.id
from public.profiles p
where p.username = 'id1'
on conflict (user_id) do nothing;

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

create unique index if not exists profiles_invite_code_idx
  on public.profiles (invite_code)
  where invite_code is not null;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create index if not exists profiles_aura_points_idx on public.profiles (aura_points desc);
create index if not exists votes_target_vote_type_idx on public.votes (target_id, vote_type);
create index if not exists votes_target_created_idx on public.votes (target_id, created_at desc);
create index if not exists votes_voter_created_idx on public.votes (voter_id, created_at desc);
create index if not exists votes_voter_anon_created_idx on public.votes (voter_id, created_at desc) where is_anonymous = true;
create index if not exists boosts_profile_expires_idx on public.boosts (profile_id, expires_at desc);
create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists transactions_positive_created_idx on public.transactions (created_at desc) where amount > 0;
create index if not exists profile_moderation_limited_idx on public.profile_moderation_states (is_limited, updated_at desc) where is_limited = true;
create index if not exists profile_moderation_discover_idx on public.profile_moderation_states (hide_from_discover, updated_at desc) where hide_from_discover = true;
create index if not exists profile_moderation_leaderboards_idx on public.profile_moderation_states (hide_from_leaderboards, updated_at desc) where hide_from_leaderboards = true;
create index if not exists ops_events_scope_created_idx on public.ops_events (scope, created_at desc);
create index if not exists ops_events_level_created_idx on public.ops_events (level, created_at desc);
create index if not exists ops_events_profile_created_idx on public.ops_events (profile_id, created_at desc) where profile_id is not null;
create index if not exists aura_effects_profile_type_expires_idx on public.aura_effects (profile_id, effect_type, expires_at desc);
create index if not exists aura_effects_active_idx on public.aura_effects (effect_type, expires_at desc);
create index if not exists reward_events_user_created_idx on public.reward_events (user_id, created_at desc);
create index if not exists user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc);
create index if not exists profile_weekly_titles_active_idx on public.profile_weekly_titles (is_active, week_end desc);
create index if not exists profile_weekly_titles_profile_idx on public.profile_weekly_titles (profile_id, assigned_at desc);
create unique index if not exists notification_events_channel_dedupe_idx on public.notification_events (channel, dedupe_key) where dedupe_key is not null;
create index if not exists notification_events_queue_idx on public.notification_events (status, scheduled_for asc, created_at asc);
create index if not exists notification_events_profile_idx on public.notification_events (profile_id, created_at desc);
create index if not exists notification_events_status_created_idx on public.notification_events (status, created_at desc);
create index if not exists notification_events_status_schedule_processing_idx on public.notification_events (status, scheduled_for asc, processing_started_at asc);
create index if not exists leaderboard_presence_states_top_idx on public.leaderboard_presence_states (in_top10, updated_at desc);
create index if not exists referrals_inviter_status_idx on public.referrals (inviter_id, status, joined_at desc);
create index if not exists referrals_invitee_status_idx on public.referrals (invitee_id, status, joined_at desc);
create unique index if not exists shareable_moments_profile_dedupe_idx on public.shareable_moments (profile_id, dedupe_key) where dedupe_key is not null;
create index if not exists shareable_moments_profile_created_idx on public.shareable_moments (profile_id, created_at desc);
create index if not exists runtime_jobs_queue_idx on public.runtime_jobs (status, scheduled_for asc, processing_started_at asc, created_at asc);
create index if not exists runtime_jobs_type_status_idx on public.runtime_jobs (job_type, status, created_at desc);
create index if not exists rate_limit_counters_window_idx on public.rate_limit_counters (window_ends_at asc, updated_at asc);

alter table public.profiles enable row level security;
alter table public.votes enable row level security;
alter table public.boosts enable row level security;
alter table public.transactions enable row level security;
alter table public.platform_admins enable row level security;
alter table public.aura_effects enable row level security;
alter table public.reward_events enable row level security;
alter table public.achievements_catalog enable row level security;
alter table public.user_achievements enable row level security;
alter table public.weekly_titles_catalog enable row level security;
alter table public.profile_weekly_titles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.leaderboard_presence_states enable row level security;
alter table public.referrals enable row level security;
alter table public.shareable_moments enable row level security;
alter table public.runtime_jobs enable row level security;
alter table public.rate_limit_counters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_all') then
    create policy profiles_select_all on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'votes' and policyname = 'votes_select_all') then
    create policy votes_select_all on public.votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'votes' and policyname = 'votes_insert_own') then
    create policy votes_insert_own on public.votes for insert with check (auth.uid() = voter_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boosts' and policyname = 'boosts_select_all') then
    create policy boosts_select_all on public.boosts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boosts' and policyname = 'boosts_insert_own') then
    create policy boosts_insert_own on public.boosts for insert with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_select_own') then
    create policy transactions_select_own on public.transactions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_own') then
    create policy transactions_insert_own on public.transactions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'aura_effects' and policyname = 'aura_effects_select_all') then
    create policy aura_effects_select_all on public.aura_effects for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'aura_effects' and policyname = 'aura_effects_insert_own') then
    create policy aura_effects_insert_own on public.aura_effects for insert with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reward_events' and policyname = 'reward_events_select_own') then
    create policy reward_events_select_own on public.reward_events for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'achievements_catalog' and policyname = 'achievements_catalog_select_all') then
    create policy achievements_catalog_select_all on public.achievements_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_achievements' and policyname = 'user_achievements_select_own') then
    create policy user_achievements_select_own on public.user_achievements for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'weekly_titles_catalog' and policyname = 'weekly_titles_catalog_select_all') then
    create policy weekly_titles_catalog_select_all on public.weekly_titles_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_weekly_titles' and policyname = 'profile_weekly_titles_select_all') then
    create policy profile_weekly_titles_select_all on public.profile_weekly_titles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_select_own') then
    create policy notification_preferences_select_own on public.notification_preferences for select using (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_insert_own') then
    create policy notification_preferences_insert_own on public.notification_preferences for insert with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'notification_preferences_update_own') then
    create policy notification_preferences_update_own on public.notification_preferences for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_events' and policyname = 'notification_events_select_own') then
    create policy notification_events_select_own on public.notification_events for select using (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leaderboard_presence_states' and policyname = 'leaderboard_presence_states_select_own') then
    create policy leaderboard_presence_states_select_own on public.leaderboard_presence_states for select using (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referrals' and policyname = 'referrals_select_related') then
    create policy referrals_select_related on public.referrals for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shareable_moments' and policyname = 'shareable_moments_select_own') then
    create policy shareable_moments_select_own on public.shareable_moments for select using (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'runtime_jobs' and policyname = 'runtime_jobs_service_role_only') then
    create policy runtime_jobs_service_role_only on public.runtime_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rate_limit_counters' and policyname = 'rate_limit_counters_service_role_only') then
    create policy rate_limit_counters_service_role_only on public.rate_limit_counters for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;

create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select lower(encode(gen_random_bytes(6), 'hex'));
$$;

do $$
declare
  v_profile_id uuid;
  v_candidate text;
begin
  for v_profile_id in select p.id from public.profiles p where p.invite_code is null
  loop
    loop
      v_candidate := public.generate_invite_code();
      exit when not exists (select 1 from public.profiles p where p.invite_code = v_candidate);
    end loop;

    update public.profiles
    set invite_code = v_candidate
    where id = v_profile_id
      and invite_code is null;
  end loop;
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

  insert into public.profiles (id, username, display_name, avatar_url, telegram_user, telegram_id, is_nickname_selected)
  values (
    new.id,
    v_username,
    v_username,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    nullif(new.raw_user_meta_data->>'telegram_id', '')::bigint,
    false
  )
  on conflict (id) do update
  set avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      telegram_user = coalesce(excluded.telegram_user, public.profiles.telegram_user),
      telegram_id = coalesce(excluded.telegram_id, public.profiles.telegram_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update on auth.users
  for each row
  execute procedure public.handle_new_user();

create or replace function public.prevent_special_card_direct_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.special_card is distinct from old.special_card
    and current_user <> 'postgres'
    and current_user <> 'service_role'
  then
    raise exception 'special_card can only be changed via admin function';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_special_card on public.profiles;

create trigger profiles_guard_special_card
  before update on public.profiles
  for each row
  execute procedure public.prevent_special_card_direct_update();

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = p_user_id
  );
end;
$$;

create or replace function public.set_profile_special_card(
  p_target_id uuid,
  p_special_card text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_next_special_card text := nullif(btrim(coalesce(p_special_card, '')), '');
begin
  if auth.role() <> 'service_role' then
    if v_actor_id is null then
      raise exception 'Not authenticated';
    end if;

    if not public.is_platform_admin(v_actor_id) then
      raise exception 'Only platform admins can set special cards';
    end if;
  end if;

  if v_next_special_card is not null and v_next_special_card <> 'RESONANCE' then
    raise exception 'Unsupported special card value: %', v_next_special_card;
  end if;

  update public.profiles
  set special_card = v_next_special_card
  where id = p_target_id;

  if not found then
    raise exception 'Profile not found for id %', p_target_id;
  end if;
end;
$$;

create or replace function public.set_profile_moderation_state(
  p_profile_id uuid,
  p_is_limited boolean default null,
  p_hide_from_discover boolean default null,
  p_hide_from_leaderboards boolean default null,
  p_reason text default null,
  p_note text default null
)
returns table (
  profile_id uuid,
  is_limited boolean,
  hide_from_discover boolean,
  hide_from_leaderboards boolean,
  reason text,
  note text,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_state public.profile_moderation_states%rowtype;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if v_actor_id is null then
      raise exception 'Not authenticated';
    end if;
    if not public.is_platform_admin(v_actor_id) then
      raise exception 'Only platform admins can update moderation state';
    end if;
  end if;

  insert into public.profile_moderation_states (
    profile_id, is_limited, hide_from_discover, hide_from_leaderboards, reason, note, updated_by, updated_at
  )
  values (
    p_profile_id,
    coalesce(p_is_limited, false),
    coalesce(p_hide_from_discover, false),
    coalesce(p_hide_from_leaderboards, false),
    nullif(btrim(coalesce(p_reason, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor_id,
    timezone('utc'::text, now())
  )
  on conflict (profile_id) do update
  set is_limited = coalesce(p_is_limited, public.profile_moderation_states.is_limited),
      hide_from_discover = coalesce(p_hide_from_discover, public.profile_moderation_states.hide_from_discover),
      hide_from_leaderboards = coalesce(p_hide_from_leaderboards, public.profile_moderation_states.hide_from_leaderboards),
      reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), public.profile_moderation_states.reason),
      note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), public.profile_moderation_states.note),
      updated_by = coalesce(v_actor_id, public.profile_moderation_states.updated_by),
      updated_at = timezone('utc'::text, now())
  returning * into v_state;

  insert into public.ops_events (level, scope, event_type, profile_id, actor_id, message, payload)
  values (
    'warn',
    'admin',
    'profile_moderation_updated',
    p_profile_id,
    v_actor_id,
    'Profile moderation state updated',
    jsonb_build_object(
      'isLimited', v_state.is_limited,
      'hideFromDiscover', v_state.hide_from_discover,
      'hideFromLeaderboards', v_state.hide_from_leaderboards,
      'reason', v_state.reason,
      'note', v_state.note
    )
  );

  return query
    select v_state.profile_id, v_state.is_limited, v_state.hide_from_discover, v_state.hide_from_leaderboards, v_state.reason, v_state.note, v_state.updated_at;
end;
$$;

create or replace function public.ensure_profile_invite_code(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_candidate text;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to ensure invite code for another profile';
    end if;
  end if;

  select p.invite_code into v_existing from public.profiles p where p.id = p_profile_id for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  if nullif(btrim(coalesce(v_existing, '')), '') is not null then
    return v_existing;
  end if;

  loop
    v_candidate := public.generate_invite_code();
    exit when not exists (select 1 from public.profiles p where p.invite_code = v_candidate);
  end loop;

  update public.profiles set invite_code = v_candidate where id = p_profile_id;
  return v_candidate;
end;
$$;

create or replace function public.create_shareable_moment(
  p_profile_id uuid,
  p_moment_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns table (created boolean, moment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moment_id uuid;
  v_dedupe_key text := nullif(btrim(coalesce(p_dedupe_key, '')), '');
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;
  if nullif(btrim(coalesce(p_moment_type, '')), '') is null then
    raise exception 'Moment type is required';
  end if;
  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to create shareable moment for another profile';
    end if;
  end if;

  insert into public.shareable_moments (profile_id, moment_type, dedupe_key, payload)
  values (p_profile_id, p_moment_type, v_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (profile_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_moment_id;

  if v_moment_id is null then
    return query select false, null::uuid;
    return;
  end if;

  return query select true, v_moment_id;
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

  select p.aura_points into v_current_aura from public.profiles p where p.id = target_id for update;
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

  update public.profiles set aura_points = v_next_aura where id = target_id;

  if v_next_aura > v_current_aura then
    perform public.process_profile_progression(
      target_id,
      v_current_aura,
      v_next_aura,
      jsonb_build_object('source', 'increment_aura', 'delta', amount)
    );
  end if;
end;
$$;

create or replace function public.grant_achievement(
  p_profile_id uuid,
  p_achievement_key text,
  p_context jsonb default '{}'::jsonb
)
returns table (granted boolean, reward integer, title text)
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

  select * into v_achievement
  from public.achievements_catalog c
  where c.key = p_achievement_key and c.is_active = true;

  if not found then
    return query select false, 0, null::text;
    return;
  end if;

  insert into public.user_achievements (user_id, achievement_key, metadata)
  values (p_profile_id, v_achievement.key, coalesce(p_context, '{}'::jsonb))
  on conflict (user_id, achievement_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select false, 0, v_achievement.title;
    return;
  end if;

  v_reward := greatest(coalesce(v_achievement.reward, 0), 0);

  if v_reward > 0 then
    select p.aura_points into v_previous_aura from public.profiles p where p.id = p_profile_id for update;
    if not found then
      raise exception 'Profile not found for id %', p_profile_id;
    end if;

    update public.profiles set aura_points = aura_points + v_reward where id = p_profile_id
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

  perform 1
  from public.create_shareable_moment(
    p_profile_id,
    'achievement_unlocked',
    jsonb_build_object('achievementKey', v_achievement.key, 'achievementTitle', v_achievement.title, 'reward', v_reward),
    format('achievement:%s', v_achievement.key)
  );

  return query select true, v_reward, v_achievement.title;
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
    perform 1 from public.grant_achievement(
      p_profile_id,
      'first_out_of_npc',
      coalesce(p_context, '{}'::jsonb) || jsonb_build_object('source', 'profile_progression', 'threshold', 501, 'fromAura', coalesce(p_previous_aura, 0), 'toAura', coalesce(p_current_aura, 0))
    );
    perform 1 from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'hero', 'tierLabel', 'Герой', 'threshold', 501, 'fromAura', coalesce(p_previous_aura, 0), 'toAura', coalesce(p_current_aura, 0)),
      'tier:hero'
    );
    perform 1 from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'hero', 'tierLabel', 'Герой', 'threshold', 501, 'toAura', coalesce(p_current_aura, 0)),
      'tier-reached:hero',
      'telegram'
    );
  end if;

  if coalesce(p_previous_aura, 0) < 1000 and coalesce(p_current_aura, 0) >= 1000 then
    perform 1 from public.grant_achievement(
      p_profile_id,
      'aura_1000',
      coalesce(p_context, '{}'::jsonb) || jsonb_build_object('source', 'profile_progression', 'threshold', 1000, 'fromAura', coalesce(p_previous_aura, 0), 'toAura', coalesce(p_current_aura, 0))
    );
  end if;

  if coalesce(p_previous_aura, 0) < 2001 and coalesce(p_current_aura, 0) >= 2001 then
    perform 1 from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'that_one', 'tierLabel', 'Тот самый', 'threshold', 2001, 'fromAura', coalesce(p_previous_aura, 0), 'toAura', coalesce(p_current_aura, 0)),
      'tier:that_one'
    );
    perform 1 from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'that_one', 'tierLabel', 'Тот самый', 'threshold', 2001, 'toAura', coalesce(p_current_aura, 0)),
      'tier-reached:that_one',
      'telegram'
    );
  end if;

  if coalesce(p_previous_aura, 0) < 5001 and coalesce(p_current_aura, 0) >= 5001 then
    perform 1 from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'sigma', 'tierLabel', 'Сигма', 'threshold', 5001, 'fromAura', coalesce(p_previous_aura, 0), 'toAura', coalesce(p_current_aura, 0)),
      'tier:sigma'
    );
    perform 1 from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object('tierKey', 'sigma', 'tierLabel', 'Сигма', 'threshold', 5001, 'toAura', coalesce(p_current_aura, 0)),
      'tier-reached:sigma',
      'telegram'
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
returns table (granted boolean, reward integer)
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
  values (p_profile_id, p_event_key, v_event_scope, v_reward, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, event_key, event_scope) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select false, 0;
    return;
  end if;

  if v_reward > 0 then
    select p.aura_points into v_previous_aura from public.profiles p where p.id = p_profile_id for update;
    if not found then
      raise exception 'Profile not found for id %', p_profile_id;
    end if;

    update public.profiles set aura_points = aura_points + v_reward where id = p_profile_id
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
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'event_reward', 'eventKey', p_event_key, 'eventScope', v_event_scope, 'trigger', 'grant_event_reward_once')
    );
  end if;

  return query select true, v_reward;
end;
$$;

create or replace function public.purchase_decay_shield(p_profile_id uuid, p_cost integer default 120, p_duration_hours integer default 24)
returns table (expires_at timestamp with time zone, aura_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_cost integer := greatest(coalesce(p_cost, 120), 1);
  v_duration integer := greatest(coalesce(p_duration_hours, 24), 1);
  v_active_until timestamp with time zone;
  v_aura_before integer;
  v_aura_after integer;
  v_expires_at timestamp with time zone;
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to purchase decay shield for another profile';
  end if;
  select p.aura_points into v_aura_before from public.profiles p where p.id = p_profile_id for update;
  if not found then raise exception 'Profile not found for id %', p_profile_id; end if;

  select ae.expires_at into v_active_until
  from public.aura_effects ae
  where ae.profile_id = p_profile_id and ae.effect_type = 'DECAY_SHIELD' and ae.expires_at > v_now
  order by ae.expires_at desc limit 1;

  if v_active_until is not null then raise exception 'Decay shield already active until %', v_active_until; end if;
  if v_aura_before < v_cost then raise exception 'Insufficient aura'; end if;

  v_expires_at := v_now + make_interval(hours => v_duration);
  v_aura_after := v_aura_before - v_cost;

  update public.profiles set aura_points = v_aura_after where id = p_profile_id;
  insert into public.aura_effects (profile_id, effect_type, effect_variant, starts_at, expires_at, metadata)
  values (p_profile_id, 'DECAY_SHIELD', 'STANDARD', v_now, v_expires_at, jsonb_build_object('source', 'decay_shield', 'cost', v_cost, 'durationHours', v_duration));
  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'decay_shield_purchase',
    format('Щит от угасания на %s ч', v_duration),
    jsonb_build_object('source', 'decay_shield', 'cost', v_cost, 'durationHours', v_duration, 'expiresAt', v_expires_at, 'auraBefore', v_aura_before, 'auraAfter', v_aura_after)
  );

  return query select v_expires_at, v_aura_after;
end;
$$;

create or replace function public.purchase_card_accent(p_profile_id uuid, p_variant text, p_cost integer default 70, p_duration_hours integer default 24)
returns table (effect_variant text, expires_at timestamp with time zone, aura_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_variant text := upper(coalesce(nullif(btrim(coalesce(p_variant, '')), ''), ''));
  v_cost integer := greatest(coalesce(p_cost, 70), 1);
  v_duration integer := greatest(coalesce(p_duration_hours, 24), 1);
  v_active_until timestamp with time zone;
  v_active_variant text;
  v_aura_before integer;
  v_aura_after integer;
  v_expires_at timestamp with time zone;
  v_variant_label text;
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to purchase card accent for another profile';
  end if;
  if v_variant not in ('NEON_EDGE', 'GOLD_PULSE', 'FROST_RING') then raise exception 'Unsupported accent variant: %', v_variant; end if;

  select p.aura_points into v_aura_before from public.profiles p where p.id = p_profile_id for update;
  if not found then raise exception 'Profile not found for id %', p_profile_id; end if;

  select ae.expires_at, ae.effect_variant into v_active_until, v_active_variant
  from public.aura_effects ae
  where ae.profile_id = p_profile_id and ae.effect_type = 'CARD_ACCENT' and ae.expires_at > v_now
  order by ae.expires_at desc limit 1;

  if v_active_until is not null then raise exception 'Card accent already active (% until %)', coalesce(v_active_variant, 'UNKNOWN'), v_active_until; end if;
  if v_aura_before < v_cost then raise exception 'Insufficient aura'; end if;

  v_expires_at := v_now + make_interval(hours => v_duration);
  v_aura_after := v_aura_before - v_cost;
  v_variant_label := case v_variant when 'NEON_EDGE' then 'Неоновая грань' when 'GOLD_PULSE' then 'Золотой импульс' when 'FROST_RING' then 'Ледяной контур' else v_variant end;

  update public.profiles set aura_points = v_aura_after where id = p_profile_id;
  insert into public.aura_effects (profile_id, effect_type, effect_variant, starts_at, expires_at, metadata)
  values (p_profile_id, 'CARD_ACCENT', v_variant, v_now, v_expires_at, jsonb_build_object('source', 'card_accent', 'variant', v_variant, 'cost', v_cost, 'durationHours', v_duration));
  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'card_accent_purchase',
    format('Акцент карточки: %s (%s ч)', v_variant_label, v_duration),
    jsonb_build_object('source', 'card_accent', 'variant', v_variant, 'variantLabel', v_variant_label, 'cost', v_cost, 'durationHours', v_duration, 'expiresAt', v_expires_at, 'auraBefore', v_aura_before, 'auraAfter', v_aura_after)
  );

  return query select v_variant, v_expires_at, v_aura_after;
end;
$$;

create or replace function public.rescue_streak_with_aura(p_profile_id uuid, p_cost integer default 90, p_cooldown_hours integer default 168)
returns table (last_reward_at timestamp with time zone, streak integer, aura_left integer, cooldown_until timestamp with time zone)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_today date := (v_now at time zone 'utc')::date;
  v_cost integer := greatest(coalesce(p_cost, 90), 1);
  v_cooldown_hours integer := greatest(coalesce(p_cooldown_hours, 168), 1);
  v_aura_before integer;
  v_aura_after integer;
  v_streak integer;
  v_last_reward_at timestamp with time zone;
  v_last_reward_day date;
  v_last_streak_save_at timestamp with time zone;
  v_cooldown_until timestamp with time zone;
  v_saved_last_reward_at timestamp with time zone;
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to rescue streak for another profile';
  end if;

  select p.aura_points, p.daily_streak, p.last_reward_at, p.last_streak_save_at
  into v_aura_before, v_streak, v_last_reward_at, v_last_streak_save_at
  from public.profiles p where p.id = p_profile_id for update;
  if not found then raise exception 'Profile not found for id %', p_profile_id; end if;
  v_streak := coalesce(v_streak, 0);
  if v_streak <= 0 or v_last_reward_at is null then raise exception 'No streak to rescue'; end if;
  v_last_reward_day := (v_last_reward_at at time zone 'utc')::date;
  if v_last_reward_day <> (v_today - 2) then raise exception 'Streak rescue is available only after one missed day'; end if;
  if v_last_streak_save_at is not null then
    v_cooldown_until := v_last_streak_save_at + make_interval(hours => v_cooldown_hours);
    if v_cooldown_until > v_now then raise exception 'Streak rescue is on cooldown until %', v_cooldown_until; end if;
  end if;
  if v_aura_before < v_cost then raise exception 'Insufficient aura'; end if;

  v_saved_last_reward_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) - interval '1 minute');
  v_aura_after := v_aura_before - v_cost;
  v_cooldown_until := v_now + make_interval(hours => v_cooldown_hours);

  update public.profiles
  set aura_points = v_aura_after, last_reward_at = v_saved_last_reward_at, last_streak_save_at = v_now
  where id = p_profile_id;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'streak_save',
    'Сохранение серии: страховка 1 пропущенного дня',
    jsonb_build_object('source', 'streak_save', 'cost', v_cost, 'streak', v_streak, 'lastRewardDayBefore', v_last_reward_day, 'savedLastRewardAt', v_saved_last_reward_at, 'cooldownHours', v_cooldown_hours, 'cooldownUntil', v_cooldown_until, 'auraBefore', v_aura_before, 'auraAfter', v_aura_after)
  );

  return query select v_saved_last_reward_at, v_streak, v_aura_after, v_cooldown_until;
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
  v_elapsed_seconds numeric;
  v_protected_seconds numeric := 0;
  v_raw_days integer;
  v_effective_days integer;
  v_new_aura integer;
  v_aura_to_lose integer;
begin
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to apply decay for another profile';
  end if;
  select p.aura_points, p.last_decay_at into v_aura, v_last_decay_at from public.profiles p where p.id = p_profile_id for update;
  if not found then return 0; end if;
  if v_last_decay_at is null then update public.profiles set last_decay_at = v_now where id = p_profile_id; return 0; end if;

  v_elapsed_seconds := greatest(extract(epoch from (v_now - v_last_decay_at)), 0);
  v_raw_days := floor(v_elapsed_seconds / 86400);
  if v_raw_days < 1 then return 0; end if;

  select coalesce(sum(greatest(extract(epoch from least(ae.expires_at, v_now) - greatest(ae.starts_at, v_last_decay_at)), 0)), 0)
  into v_protected_seconds
  from public.aura_effects ae
  where ae.profile_id = p_profile_id and ae.effect_type = 'DECAY_SHIELD' and ae.expires_at > v_last_decay_at and ae.starts_at < v_now;

  v_effective_days := floor(greatest(v_elapsed_seconds - v_protected_seconds, 0) / 86400);
  if v_effective_days < 1 then return 0; end if;

  v_new_aura := floor(v_aura * power(0.97::numeric, v_effective_days));
  v_aura_to_lose := greatest(v_aura - v_new_aura, 0);

  update public.profiles set aura_points = greatest(aura_points - v_aura_to_lose, 0), last_decay_at = v_now where id = p_profile_id;

  if v_aura_to_lose > 0 then
    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_profile_id,
      -v_aura_to_lose,
      'decay',
      format('Угасание ауры: %s дн.', v_effective_days),
      jsonb_build_object('daysPassed', v_effective_days, 'rawDays', v_raw_days, 'shieldProtectedHours', round((v_protected_seconds / 3600.0)::numeric, 2), 'ratePerDay', 0.03)
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
  v_milestones integer[] := array[3, 7, 14, 30];
  v_milestone_rewards integer[] := array[4, 8, 12, 20];
  v_index integer;
  v_granted boolean;
  v_reward_value integer;
  v_week_start timestamp with time zone;
  v_week_end timestamp with time zone;
  v_week_scope text;
  v_weekly_active_days integer := 0;
  v_achievement_title text;
  v_unlocked_achievements text[] := array[]::text[];
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to claim reward for another profile';
  end if;

  select p.daily_streak, p.last_reward_at, p.aura_points into v_streak, v_previous_reward_at, v_aura_before
  from public.profiles p where p.id = p_profile_id for update;
  if not found then raise exception 'Profile not found'; end if;

  v_streak := coalesce(v_streak, 0);
  v_previous_reward_day := case when v_previous_reward_at is null then null else (v_previous_reward_at at time zone 'utc')::date end;
  v_available_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) + interval '1 day');
  if v_previous_reward_day = v_today then
    v_next_reward := least(8 + (greatest(v_streak, 0) * 2), 18);
    return query select false, 0, greatest(v_streak, 0), v_next_reward, v_previous_reward_at, v_available_at, 0, 0, 0, 0, 0, array[]::text[];
    return;
  end if;

  if v_previous_reward_day = (v_today - 1) then v_streak := greatest(v_streak, 0) + 1; else v_streak := 1; end if;
  v_base_reward := least(8 + ((v_streak - 1) * 2), 18);
  v_next_reward := least(8 + (v_streak * 2), 18);

  update public.profiles
  set aura_points = aura_points + v_base_reward, daily_streak = v_streak, last_reward_at = v_now
  where id = p_profile_id
  returning public.profiles.last_reward_at, public.profiles.aura_points into v_last_reward_at, v_aura_after;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    v_base_reward,
    'daily_reward',
    format('Награда за серию: день %s', v_streak),
    jsonb_build_object('source', 'daily_reward', 'streak', v_streak, 'reward', v_base_reward, 'nextReward', v_next_reward, 'rewardRole', 'supporting')
  );

  perform public.process_profile_progression(
    p_profile_id,
    v_aura_before,
    v_aura_after,
    jsonb_build_object('source', 'daily_reward', 'streak', v_streak, 'baseReward', v_base_reward)
  );

  for v_index in 1..array_length(v_milestones, 1) loop
    if v_streak >= v_milestones[v_index] then
      select e.granted, e.reward into v_granted, v_reward_value
      from public.grant_event_reward_once(
        p_profile_id,
        format('streak_milestone_%s', v_milestones[v_index]),
        'global',
        v_milestone_rewards[v_index],
        'streak_milestone',
        format('Награда за этап серии: %s дней', v_milestones[v_index]),
        jsonb_build_object('source', 'streak_milestone', 'milestoneDays', v_milestones[v_index], 'streakAtClaim', v_streak, 'reward', v_milestone_rewards[v_index])
      ) e;
      if coalesce(v_granted, false) then
        v_streak_bonus := v_streak_bonus + coalesce(v_reward_value, 0);
        perform 1 from public.create_shareable_moment(
          p_profile_id,
          'streak_milestone',
          jsonb_build_object('milestoneDays', v_milestones[v_index], 'streak', v_streak, 'reward', v_milestone_rewards[v_index]),
          format('streak-milestone:%s', v_milestones[v_index])
        );
      end if;
    end if;
  end loop;

  v_week_start := timezone('utc'::text, date_trunc('week', timezone('utc'::text, v_now)));
  v_week_end := v_week_start + interval '7 day';
  v_week_scope := ((v_week_start at time zone 'utc')::date)::text;
  select count(distinct ((t.created_at at time zone 'utc')::date)) into v_weekly_active_days
  from public.transactions t
  where t.user_id = p_profile_id and t.type = 'daily_reward' and t.created_at >= v_week_start and t.created_at < v_week_end;

  if v_weekly_active_days >= 5 then
    select e.granted, e.reward into v_granted, v_reward_value
    from public.grant_event_reward_once(
      p_profile_id,
      'weekly_activity_5_days',
      v_week_scope,
      8,
      'weekly_activity_reward',
      format('Недельная награда за активность (%s/7 дней)', v_weekly_active_days),
      jsonb_build_object('source', 'weekly_activity', 'weekStart', v_week_scope, 'activeDays', v_weekly_active_days, 'requiredDays', 5, 'reward', 8)
    ) e;
    if coalesce(v_granted, false) then v_weekly_bonus := v_weekly_bonus + coalesce(v_reward_value, 0); end if;
  end if;

  if v_streak >= 7 then
    select a.granted, a.reward, a.title into v_granted, v_reward_value, v_achievement_title
    from public.grant_achievement(p_profile_id, 'streak_7_days_first', jsonb_build_object('source', 'daily_reward', 'streak', v_streak, 'claimedAt', v_now)) a;
    if coalesce(v_granted, false) then
      v_achievement_bonus := v_achievement_bonus + coalesce(v_reward_value, 0);
      if v_achievement_title is not null then v_unlocked_achievements := array_append(v_unlocked_achievements, v_achievement_title); end if;
    end if;
  end if;

  v_bonus_total := v_streak_bonus + v_weekly_bonus + v_achievement_bonus;
  v_total_reward := v_base_reward + v_bonus_total;

  return query select true, v_total_reward, v_streak, v_next_reward, v_last_reward_at, v_available_at, v_base_reward, v_bonus_total, v_streak_bonus, v_weekly_bonus, v_achievement_bonus, v_unlocked_achievements;
end;
$$;

create or replace function public.get_growth_leaderboard(p_days integer default 7, p_limit integer default 5)
returns table (user_id uuid, username text, display_name text, aura_points integer, growth_points integer)
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
    select p.id, p.username, coalesce(nullif(btrim(p.display_name), ''), p.username), p.aura_points, coalesce(sum(t.amount), 0)::integer
    from public.transactions t
    join public.profiles p on p.id = t.user_id
    where t.amount > 0 and t.created_at >= v_since
    group by p.id, p.username, p.display_name, p.aura_points, p.created_at
    order by growth_points desc, p.aura_points desc, p.created_at asc
    limit v_limit;
end;
$$;

create or replace function public.get_aura_leaderboard(p_limit integer default 20, p_offset integer default 0)
returns table (rank_position bigint, profile_id uuid, username text, display_name text, aura_points integer)
language sql
security definer
stable
set search_path = public
as $$
  with ranked as (
    select p.id, p.username, p.display_name, p.aura_points, row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  )
  select r.rank_position, r.id, r.username, coalesce(r.display_name, r.username), r.aura_points
  from ranked r
  order by r.rank_position
  offset greatest(coalesce(p_offset, 0), 0)
  limit greatest(coalesce(p_limit, 20), 1);
$$;

create or replace function public.get_profile_leaderboard_context(p_profile_id uuid, p_top_target integer default 10)
returns table (
  profile_id uuid, username text, display_name text, aura_points integer, rank_position bigint, distance_to_next integer, distance_to_top_target integer,
  above_profile_id uuid, above_username text, above_display_name text, above_aura_points integer,
  below_profile_id uuid, below_username text, below_display_name text, below_aura_points integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_top_target integer := greatest(coalesce(p_top_target, 10), 1);
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to read leaderboard context for another profile';
  end if;

  return query
  with ranked as (
    select p.id, p.username, coalesce(p.display_name, p.username) as display_name, p.aura_points, row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  ),
  me as (select * from ranked where id = p_profile_id),
  above_me as (select * from ranked where rank_position = (select rank_position - 1 from me)),
  below_me as (select * from ranked where rank_position = (select rank_position + 1 from me)),
  top_target as (select * from ranked where rank_position = v_top_target)
  select
    me.id, me.username, me.display_name, me.aura_points, me.rank_position,
    case when above_me.id is null then 0 else greatest((above_me.aura_points - me.aura_points) + 1, 1) end,
    case when me.rank_position <= v_top_target then 0 when top_target.id is null then 0 else greatest((top_target.aura_points - me.aura_points) + 1, 0) end,
    above_me.id, above_me.username, above_me.display_name, above_me.aura_points,
    below_me.id, below_me.username, below_me.display_name, below_me.aura_points
  from me
  left join above_me on true
  left join below_me on true
  left join top_target on true;
end;
$$;

create or replace function public.enqueue_notification_event(
  p_profile_id uuid, p_event_type text, p_payload jsonb default '{}'::jsonb, p_dedupe_key text default null, p_channel text default 'telegram',
  p_scheduled_for timestamp with time zone default timezone('utc'::text, now())
)
returns table (enqueued boolean, event_id uuid, status text, reason text)
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
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if nullif(btrim(coalesce(p_event_type, '')), '') is null then raise exception 'Event type is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to enqueue event for another profile';
  end if;

  select * into v_profile from public.profiles p where p.id = p_profile_id;
  if not found then raise exception 'Profile not found for id %', p_profile_id; end if;

  insert into public.notification_preferences (profile_id) values (p_profile_id) on conflict (profile_id) do nothing;
  select * into v_pref from public.notification_preferences np where np.profile_id = p_profile_id;

  if v_channel <> 'telegram' then raise exception 'Unsupported channel: %', v_channel; end if;
  if not coalesce(v_pref.telegram_enabled, true) then
    v_allowed := false; v_status := 'skipped'; v_reason := 'telegram_disabled';
  elsif v_profile.telegram_id is null then
    v_allowed := false; v_status := 'skipped'; v_reason := 'telegram_id_missing';
  end if;

  if v_allowed then
    if p_event_type = 'new_vote' and not coalesce(v_pref.notify_new_vote, true) then
      v_allowed := false; v_status := 'skipped'; v_reason := 'new_vote_disabled';
    elsif p_event_type = 'aura_changed' and not coalesce(v_pref.notify_aura_change, true) then
      v_allowed := false; v_status := 'skipped'; v_reason := 'aura_disabled';
    elsif p_event_type = 'streak_reminder' and not coalesce(v_pref.notify_streak, true) then
      v_allowed := false; v_status := 'skipped'; v_reason := 'streak_disabled';
    elsif p_event_type in ('leaderboard_top10_entered', 'leaderboard_top10_dropped') and not coalesce(v_pref.notify_leaderboard, true) then
      v_allowed := false; v_status := 'skipped'; v_reason := 'leaderboard_disabled';
    end if;
  end if;

  insert into public.notification_events (profile_id, channel, event_type, dedupe_key, payload, status, scheduled_for)
  values (p_profile_id, v_channel, p_event_type, v_dedupe_key, coalesce(p_payload, '{}'::jsonb), v_status, coalesce(p_scheduled_for, timezone('utc'::text, now())))
  on conflict (channel, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return query select false, null::uuid, 'skipped'::text, 'duplicate_dedupe_key'::text;
    return;
  end if;

  return query select true, v_event_id, v_status, v_reason;
end;
$$;

create or replace function public.sync_leaderboard_presence_event(p_profile_id uuid)
returns table (rank_position bigint, in_top10 boolean, entered_top10 boolean, dropped_from_top10 boolean)
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
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to sync leaderboard state for another profile';
  end if;

  with ranked as (
    select p.id, row_number() over (order by p.aura_points desc, p.created_at asc, p.id asc) as rank_position
    from public.profiles p
  )
  select r.rank_position into v_rank from ranked r where r.id = p_profile_id;
  if v_rank is null then raise exception 'Profile not found for id %', p_profile_id; end if;
  v_in_top10 := v_rank <= 10;

  select lps.in_top10, lps.last_rank into v_prev_in_top10, v_prev_rank from public.leaderboard_presence_states lps where lps.profile_id = p_profile_id;
  if not found then v_prev_in_top10 := false; v_prev_rank := null; end if;

  insert into public.leaderboard_presence_states (profile_id, last_rank, in_top10, updated_at)
  values (p_profile_id, v_rank, v_in_top10, timezone('utc'::text, now()))
  on conflict (profile_id) do update
  set last_rank = excluded.last_rank, in_top10 = excluded.in_top10, updated_at = excluded.updated_at;

  if v_in_top10 and not coalesce(v_prev_in_top10, false) then
    perform 1 from public.enqueue_notification_event(p_profile_id, 'leaderboard_top10_entered', jsonb_build_object('rank', v_rank, 'previousRank', v_prev_rank), format('leaderboard-entered-top10:%s:%s', p_profile_id::text, v_rank::text), 'telegram');
    perform 1 from public.create_shareable_moment(p_profile_id, 'leaderboard_top10_entered', jsonb_build_object('rank', v_rank, 'previousRank', v_prev_rank), 'leaderboard-top10-entered');
  elsif not v_in_top10 and coalesce(v_prev_in_top10, false) then
    perform 1 from public.enqueue_notification_event(p_profile_id, 'leaderboard_top10_dropped', jsonb_build_object('rank', v_rank, 'previousRank', v_prev_rank), format('leaderboard-dropped-top10:%s:%s', p_profile_id::text, v_rank::text), 'telegram');
  end if;

  return query select v_rank, v_in_top10, (v_in_top10 and not coalesce(v_prev_in_top10, false)), (not v_in_top10 and coalesce(v_prev_in_top10, false));
end;
$$;

create or replace function public.refresh_weekly_titles(p_reference timestamp with time zone default timezone('utc'::text, now()))
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
  update public.profile_weekly_titles set is_active = false where is_active = true and week_end <= ((timezone('utc'::text, now())) at time zone 'utc')::date;
  delete from public.profile_weekly_titles where week_start = v_week_start;

  select p.id, p.aura_points into v_aura_leader_id, v_aura_score from public.profiles p order by p.aura_points desc, p.created_at asc, p.id asc limit 1;
  if v_aura_leader_id is not null then
    insert into public.profile_weekly_titles (profile_id, title_key, week_start, week_end, score, metadata, is_active)
    values (v_aura_leader_id, 'weekly_aura_champion', v_week_start, v_week_end, coalesce(v_aura_score, 0), jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'aura_points'), true)
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id, week_end = excluded.week_end, score = excluded.score, metadata = excluded.metadata, is_active = true, assigned_at = timezone('utc'::text, now());
  end if;

  select g.user_id, g.growth_points into v_growth_leader_id, v_growth_score from public.get_growth_leaderboard(7, 1) g order by g.growth_points desc limit 1;
  if v_growth_leader_id is not null and coalesce(v_growth_score, 0) > 0 then
    insert into public.profile_weekly_titles (profile_id, title_key, week_start, week_end, score, metadata, is_active)
    values (v_growth_leader_id, 'weekly_rise_rocket', v_week_start, v_week_end, coalesce(v_growth_score, 0), jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'growth_7d'), true)
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id, week_end = excluded.week_end, score = excluded.score, metadata = excluded.metadata, is_active = true, assigned_at = timezone('utc'::text, now());
  end if;

  with votes_7d as (
    select v.target_id, count(*)::integer as votes_count
    from public.votes v
    where v.created_at >= timezone('utc'::text, now()) - interval '7 day'
    group by v.target_id
  )
  select q.target_id, q.votes_count into v_hype_leader_id, v_hype_score from votes_7d q order by q.votes_count desc, q.target_id asc limit 1;

  if v_hype_leader_id is not null and coalesce(v_hype_score, 0) > 0 then
    insert into public.profile_weekly_titles (profile_id, title_key, week_start, week_end, score, metadata, is_active)
    values (v_hype_leader_id, 'weekly_hype_pulse', v_week_start, v_week_end, coalesce(v_hype_score, 0), jsonb_build_object('source', 'refresh_weekly_titles', 'metric', 'votes_7d'), true)
    on conflict (title_key, week_start) do update
    set profile_id = excluded.profile_id, week_end = excluded.week_end, score = excluded.score, metadata = excluded.metadata, is_active = true, assigned_at = timezone('utc'::text, now());
  end if;
end;
$$;

create or replace function public.get_active_weekly_titles(p_limit integer default 12)
returns table (title_key text, title text, description text, icon text, profile_id uuid, username text, display_name text, aura_points integer, score integer, week_start date, week_end date)
language sql
security definer
stable
set search_path = public
as $$
  select pwt.title_key, wtc.title, wtc.description, wtc.icon, p.id, p.username, coalesce(p.display_name, p.username), p.aura_points, pwt.score, pwt.week_start, pwt.week_end
  from public.profile_weekly_titles pwt
  join public.weekly_titles_catalog wtc on wtc.key = pwt.title_key
  join public.profiles p on p.id = pwt.profile_id
  where pwt.is_active = true and pwt.week_end > ((timezone('utc'::text, now())) at time zone 'utc')::date
  order by pwt.assigned_at desc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

create or replace function public.get_hype_profiles(p_hours integer default 24, p_limit integer default 12)
returns table (profile_id uuid, username text, display_name text, aura_points integer, votes_total integer, votes_up integer, votes_down integer, net_votes integer)
language sql
security definer
stable
set search_path = public
as $$
  with votes_window as (
    select v.target_id, count(*)::integer as votes_total, count(*) filter (where v.vote_type = 'up')::integer as votes_up, count(*) filter (where v.vote_type = 'down')::integer as votes_down
    from public.votes v
    where v.created_at >= timezone('utc'::text, now()) - make_interval(hours => greatest(coalesce(p_hours, 24), 1))
    group by v.target_id
  )
  select p.id, p.username, coalesce(p.display_name, p.username), p.aura_points, vw.votes_total, vw.votes_up, vw.votes_down, (vw.votes_up - vw.votes_down)
  from votes_window vw
  join public.profiles p on p.id = vw.target_id
  order by vw.votes_total desc, (vw.votes_up - vw.votes_down) desc, p.aura_points desc, p.created_at asc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

create or replace function public.activate_profile_boost(p_profile_id uuid, p_cost integer default 200, p_duration_minutes integer default 15)
returns table (boost_id uuid, expires_at timestamp with time zone, aura_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_cost integer := greatest(coalesce(p_cost, 200), 1);
  v_duration integer := greatest(coalesce(p_duration_minutes, 15), 1);
  v_profile public.profiles%rowtype;
  v_active_until timestamp with time zone;
  v_boost_id uuid;
  v_expires_at timestamp with time zone;
  v_aura_left integer;
begin
  if p_profile_id is null then raise exception 'Profile id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_profile_id) then
    raise exception 'Not allowed to activate boost for another profile';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = p_profile_id
  for update;
  if not found then raise exception 'Profile not found for id %', p_profile_id; end if;

  select b.expires_at into v_active_until
  from public.boosts b
  where b.profile_id = p_profile_id and b.expires_at > v_now
  order by b.expires_at desc
  limit 1;
  if v_active_until is not null then raise exception 'Boost already active until %', v_active_until; end if;
  if coalesce(v_profile.aura_points, 0) < v_cost then raise exception 'Insufficient aura'; end if;

  v_expires_at := v_now + make_interval(mins => v_duration);

  update public.profiles
  set aura_points = aura_points - v_cost
  where id = p_profile_id
  returning aura_points into v_aura_left;

  insert into public.boosts (profile_id, expires_at)
  values (p_profile_id, v_expires_at)
  returning id into v_boost_id;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'spotlight',
    format('Активация фокуса (%s минут)', v_duration),
    jsonb_build_object('source', 'spotlight', 'boostId', v_boost_id, 'durationMinutes', v_duration, 'expiresAt', v_expires_at, 'auraBefore', v_profile.aura_points, 'auraAfter', v_aura_left)
  );

  return query select v_boost_id, v_expires_at, v_aura_left;
end;
$$;

create or replace function public.cast_profile_vote(p_voter_id uuid, p_target_id uuid, p_vote_type text, p_is_anonymous boolean default false, p_anonymous_cost integer default 50, p_regular_daily_limit integer default 10, p_anonymous_daily_limit integer default 2)
returns table (vote_id uuid, aura_change integer, regular_votes_used integer, anonymous_votes_used integer, voter_aura_left integer, target_aura integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_day_start timestamp with time zone := timezone('utc'::text, date_trunc('day', timezone('utc'::text, now())));
  v_day_end timestamp with time zone := timezone('utc'::text, date_trunc('day', timezone('utc'::text, now())) + interval '1 day');
  v_type text := lower(nullif(btrim(coalesce(p_vote_type, '')), ''));
  v_voter public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_vote_id uuid;
  v_regular_used integer := 0;
  v_anonymous_used integer := 0;
  v_aura_change integer;
  v_voter_aura_left integer;
  v_target_aura integer;
begin
  if p_voter_id is null then raise exception 'Voter id is required'; end if;
  if p_target_id is null then raise exception 'Target id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_voter_id) then
    raise exception 'Not allowed to vote for another profile';
  end if;
  if v_type not in ('up', 'down') then raise exception 'Invalid vote type: %', coalesce(p_vote_type, '<null>'); end if;
  if p_voter_id = p_target_id then raise exception 'Self vote forbidden'; end if;

  select * into v_voter from public.profiles p where p.id = p_voter_id for update;
  if not found then raise exception 'Profile not found for id %', p_voter_id; end if;
  select * into v_target from public.profiles p where p.id = p_target_id for update;
  if not found then raise exception 'Profile not found for id %', p_target_id; end if;

  if exists (select 1 from public.votes v where v.voter_id = p_voter_id and v.target_id = p_target_id) then
    raise exception 'Already voted for target';
  end if;

  select count(*) filter (where v.is_anonymous = false)::integer, count(*) filter (where v.is_anonymous = true)::integer
  into v_regular_used, v_anonymous_used
  from public.votes v
  where v.voter_id = p_voter_id and v.created_at >= v_day_start and v.created_at < v_day_end;

  if coalesce(p_is_anonymous, false) then
    if v_anonymous_used >= greatest(coalesce(p_anonymous_daily_limit, 2), 0) then raise exception 'Anonymous vote daily limit reached'; end if;
    if coalesce(v_voter.aura_points, 0) < greatest(coalesce(p_anonymous_cost, 50), 0) then raise exception 'Insufficient aura'; end if;

    update public.profiles
    set aura_points = aura_points - greatest(coalesce(p_anonymous_cost, 50), 0)
    where id = p_voter_id
    returning aura_points into v_voter_aura_left;

    insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_voter_id,
      -greatest(coalesce(p_anonymous_cost, 50), 0),
      'tax',
      'Налог за анонимное голосование',
      jsonb_build_object('source', 'vote', 'anonymous', true, 'targetId', p_target_id, 'cost', greatest(coalesce(p_anonymous_cost, 50), 0), 'auraBefore', v_voter.aura_points, 'auraAfter', v_voter_aura_left)
    );
  else
    if v_regular_used >= greatest(coalesce(p_regular_daily_limit, 10), 0) then raise exception 'Regular vote daily limit reached'; end if;
    v_voter_aura_left := coalesce(v_voter.aura_points, 0);
  end if;

  insert into public.votes (voter_id, target_id, vote_type, is_anonymous)
  values (p_voter_id, p_target_id, v_type, coalesce(p_is_anonymous, false))
  returning id into v_vote_id;

  v_aura_change := case when v_type = 'up' then 10 else -10 end;

  update public.profiles
  set aura_points = greatest(aura_points + v_aura_change, 0)
  where id = p_target_id
  returning aura_points into v_target_aura;

  if v_aura_change > 0 and v_target_aura > coalesce(v_target.aura_points, 0) then
    perform public.process_profile_progression(
      p_target_id,
      coalesce(v_target.aura_points, 0),
      v_target_aura,
      jsonb_build_object('source', 'vote', 'voteId', v_vote_id, 'voterId', p_voter_id, 'anonymous', coalesce(p_is_anonymous, false))
    );
  end if;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_target_id,
    v_aura_change,
    case when v_type = 'up' then 'vote_up' else 'vote_down' end,
    case when v_type = 'up' then 'Получен плюс-аура голос' else 'Получен минус-аура голос' end,
    jsonb_build_object('source', 'vote', 'voteId', v_vote_id, 'voterId', p_voter_id, 'anonymous', coalesce(p_is_anonymous, false), 'auraBefore', v_target.aura_points, 'auraAfter', v_target_aura)
  );

  return query
    select
      v_vote_id,
      v_aura_change,
      v_regular_used + case when coalesce(p_is_anonymous, false) then 0 else 1 end,
      v_anonymous_used + case when coalesce(p_is_anonymous, false) then 1 else 0 end,
      v_voter_aura_left,
      v_target_aura;
end;
$$;

create or replace function public.bind_profile_referral(p_invitee_id uuid, p_invite_code text, p_context jsonb default '{}'::jsonb)
returns table (bound boolean, inviter_id uuid, status text, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(nullif(btrim(coalesce(p_invite_code, '')), ''));
  v_inviter public.profiles%rowtype;
  v_invitee public.profiles%rowtype;
  v_existing public.referrals%rowtype;
  v_has_activity boolean := false;
begin
  if p_invitee_id is null then raise exception 'Invitee id is required'; end if;
  if v_code is null then return query select false, null::uuid, 'skipped'::text, 'missing_invite_code'::text; return; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_invitee_id) then
    raise exception 'Not allowed to bind referral for another profile';
  end if;

  select * into v_invitee from public.profiles p where p.id = p_invitee_id for update;
  if not found then raise exception 'Profile not found for id %', p_invitee_id; end if;
  select * into v_inviter from public.profiles p where p.invite_code = v_code;
  if not found then return query select false, null::uuid, 'rejected'::text, 'invite_code_not_found'::text; return; end if;
  if v_inviter.id = p_invitee_id then return query select false, v_inviter.id, 'rejected'::text, 'self_referral'::text; return; end if;
  if v_invitee.referred_by is not null and v_invitee.referred_by <> v_inviter.id then return query select false, v_invitee.referred_by, 'rejected'::text, 'already_referred'::text; return; end if;
  if v_invitee.telegram_id is not null and v_inviter.telegram_id is not null and v_invitee.telegram_id = v_inviter.telegram_id then return query select false, v_inviter.id, 'rejected'::text, 'same_telegram_identity'::text; return; end if;
  if v_invitee.created_at < timezone('utc'::text, now()) - interval '3 day' then return query select false, v_inviter.id, 'rejected'::text, 'invite_window_expired'::text; return; end if;

  select exists (select 1 from public.votes v where v.voter_id = p_invitee_id or v.target_id = p_invitee_id)
    or exists (select 1 from public.transactions t where t.user_id = p_invitee_id and t.type in ('daily_reward', 'vote_up', 'vote_down', 'streak_milestone', 'weekly_activity_reward'))
  into v_has_activity;
  if v_has_activity then return query select false, v_inviter.id, 'rejected'::text, 'invitee_already_active'::text; return; end if;

  select * into v_existing from public.referrals r where r.invitee_id = p_invitee_id;
  update public.profiles set referred_by = v_inviter.id where id = p_invitee_id and referred_by is null;
  insert into public.referrals (inviter_id, invitee_id, invite_code, status, metadata)
  values (v_inviter.id, p_invitee_id, v_code, 'pending', coalesce(p_context, '{}'::jsonb))
  on conflict (invitee_id) do update
  set inviter_id = excluded.inviter_id,
      invite_code = excluded.invite_code,
      status = case when public.referrals.status = 'activated' then public.referrals.status else 'pending' end,
      metadata = public.referrals.metadata || excluded.metadata;

  return query select true, v_inviter.id, 'pending'::text, case when v_existing.id is null then 'bound' else 'updated' end::text;
end;
$$;

create or replace function public.activate_referral_if_eligible(p_invitee_id uuid, p_source text default 'activity', p_context jsonb default '{}'::jsonb)
returns table (activated boolean, inviter_id uuid, invitee_id uuid, inviter_reward integer, invitee_reward integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_has_claim boolean := false;
  v_has_social_action boolean := false;
  v_inviter_reward integer := 0;
  v_invitee_reward integer := 0;
  v_reward_granted boolean := false;
begin
  if p_invitee_id is null then raise exception 'Invitee id is required'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_invitee_id) then
    raise exception 'Not allowed to activate referral for another profile';
  end if;

  select * into v_referral from public.referrals r where r.invitee_id = p_invitee_id for update;
  if not found then return query select false, null::uuid, p_invitee_id, 0, 0, 'referral_missing'::text; return; end if;
  if v_referral.status = 'activated' then return query select true, v_referral.inviter_id, p_invitee_id, v_referral.inviter_reward, v_referral.invitee_reward, 'already_activated'::text; return; end if;

  select exists (select 1 from public.transactions t where t.user_id = p_invitee_id and t.type = 'daily_reward') into v_has_claim;
  select exists (
    select 1 from public.votes v
    where (v.voter_id = p_invitee_id and v.target_id <> v_referral.inviter_id)
       or (v.target_id = p_invitee_id and v.voter_id is not null and v.voter_id <> v_referral.inviter_id)
  ) into v_has_social_action;

  if not v_has_claim then return query select false, v_referral.inviter_id, p_invitee_id, 0, 0, 'waiting_first_claim'::text; return; end if;
  if not v_has_social_action then return query select false, v_referral.inviter_id, p_invitee_id, 0, 0, 'waiting_social_proof'::text; return; end if;

  select e.granted, e.reward into v_reward_granted, v_inviter_reward
  from public.grant_event_reward_once(
    v_referral.inviter_id,
    format('referral_inviter_%s', p_invitee_id::text),
    'global',
    25,
    'referral_inviter_reward',
    'Награда за активированного приглашённого',
    coalesce(p_context, '{}'::jsonb) || jsonb_build_object('source', 'referral_activation', 'inviteeId', p_invitee_id, 'inviterId', v_referral.inviter_id)
  ) e;

  select e.reward into v_invitee_reward
  from public.grant_event_reward_once(
    p_invitee_id,
    format('referral_invitee_%s', v_referral.inviter_id::text),
    'global',
    10,
    'referral_invitee_reward',
    'Бонус за вход по приглашению',
    coalesce(p_context, '{}'::jsonb) || jsonb_build_object('source', 'referral_activation', 'inviteeId', p_invitee_id, 'inviterId', v_referral.inviter_id)
  ) e;

  update public.referrals
  set status = 'activated',
      activated_at = timezone('utc'::text, now()),
      activation_source = nullif(btrim(coalesce(p_source, '')), ''),
      inviter_reward = coalesce(v_inviter_reward, 0),
      invitee_reward = coalesce(v_invitee_reward, 0),
      metadata = public.referrals.metadata || coalesce(p_context, '{}'::jsonb)
  where invitee_id = p_invitee_id;

  perform 1 from public.create_shareable_moment(
    v_referral.inviter_id,
    'referral_activated',
    jsonb_build_object('inviteeId', p_invitee_id, 'inviterReward', coalesce(v_inviter_reward, 0)),
    format('referral-activated:%s', p_invitee_id::text)
  );

  return query select true, v_referral.inviter_id, p_invitee_id, coalesce(v_inviter_reward, 0), coalesce(v_invitee_reward, 0), 'activated'::text;
end;
$$;

create or replace function public.consume_runtime_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, limit_count integer, remaining integer, retry_after_seconds integer, reset_at timestamp with time zone, current_hits integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 1), 1);
  v_limit integer := greatest(coalesce(p_limit, 1), 1);
  v_window_started timestamp with time zone;
  v_window_ends timestamp with time zone;
  v_hits integer;
begin
  if nullif(btrim(coalesce(p_bucket_key, '')), '') is null then
    raise exception 'Bucket key is required';
  end if;

  v_window_started := to_timestamp(floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds);
  v_window_ends := v_window_started + make_interval(secs => v_window_seconds);

  insert into public.rate_limit_counters (
    bucket_key,
    window_started_at,
    window_ends_at,
    hits,
    updated_at
  )
  values (
    p_bucket_key,
    v_window_started,
    v_window_ends,
    1,
    v_now
  )
  on conflict (bucket_key) do update
  set window_started_at = case
        when public.rate_limit_counters.window_ends_at <= v_now then excluded.window_started_at
        else public.rate_limit_counters.window_started_at
      end,
      window_ends_at = case
        when public.rate_limit_counters.window_ends_at <= v_now then excluded.window_ends_at
        else public.rate_limit_counters.window_ends_at
      end,
      hits = case
        when public.rate_limit_counters.window_ends_at <= v_now then 1
        else public.rate_limit_counters.hits + 1
      end,
      updated_at = v_now
  returning public.rate_limit_counters.hits, public.rate_limit_counters.window_ends_at
  into v_hits, reset_at;

  delete from public.rate_limit_counters
  where window_ends_at < v_now - interval '1 day'
    and updated_at < v_now - interval '1 day';

  allowed := v_hits <= v_limit;
  limit_count := v_limit;
  remaining := greatest(v_limit - v_hits, 0);
  retry_after_seconds := greatest(ceil(extract(epoch from (reset_at - v_now)))::integer, 0);
  current_hits := v_hits;

  return next;
end;
$$;

create or replace function public.emit_active_weekly_title_moments(p_reference timestamp with time zone default timezone('utc'::text, now()))
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_week_scope text;
begin
  for v_row in
    select pwt.profile_id, pwt.title_key, wtc.title, pwt.week_start, pwt.week_end, pwt.score
    from public.profile_weekly_titles pwt
    join public.weekly_titles_catalog wtc on wtc.key = pwt.title_key
    where pwt.is_active = true and pwt.week_end > (coalesce(p_reference, timezone('utc'::text, now())) at time zone 'utc')::date
  loop
    v_week_scope := v_row.week_start::text;
    perform 1 from public.create_shareable_moment(
      v_row.profile_id,
      'weekly_title_awarded',
      jsonb_build_object('titleKey', v_row.title_key, 'title', v_row.title, 'weekStart', v_row.week_start, 'weekEnd', v_row.week_end, 'score', v_row.score),
      format('weekly-title:%s:%s', v_row.title_key, v_week_scope)
    );
    perform 1 from public.enqueue_notification_event(
      v_row.profile_id,
      'weekly_title_awarded',
      jsonb_build_object('titleKey', v_row.title_key, 'title', v_row.title, 'weekStart', v_row.week_start, 'weekEnd', v_row.week_end, 'score', v_row.score),
      format('weekly-title-notify:%s:%s', v_row.title_key, v_week_scope),
      'telegram'
    );
  end loop;
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
revoke execute on function public.is_platform_admin(uuid) from anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;
revoke execute on function public.set_profile_special_card(uuid, text) from anon;
grant execute on function public.set_profile_special_card(uuid, text) to authenticated;
grant execute on function public.set_profile_special_card(uuid, text) to service_role;
revoke execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) from anon;
grant execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) to authenticated;
grant execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) to service_role;
revoke execute on function public.activate_profile_boost(uuid, integer, integer) from anon;
grant execute on function public.activate_profile_boost(uuid, integer, integer) to authenticated;
grant execute on function public.activate_profile_boost(uuid, integer, integer) to service_role;
revoke execute on function public.purchase_decay_shield(uuid, integer, integer) from anon;
grant execute on function public.purchase_decay_shield(uuid, integer, integer) to authenticated;
grant execute on function public.purchase_decay_shield(uuid, integer, integer) to service_role;
revoke execute on function public.purchase_card_accent(uuid, text, integer, integer) from anon;
grant execute on function public.purchase_card_accent(uuid, text, integer, integer) to authenticated;
grant execute on function public.purchase_card_accent(uuid, text, integer, integer) to service_role;
revoke execute on function public.rescue_streak_with_aura(uuid, integer, integer) from anon;
grant execute on function public.rescue_streak_with_aura(uuid, integer, integer) to authenticated;
grant execute on function public.rescue_streak_with_aura(uuid, integer, integer) to service_role;
revoke execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) from anon;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) to authenticated;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) to service_role;
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
revoke execute on function public.generate_invite_code() from public;
grant execute on function public.generate_invite_code() to service_role;
revoke execute on function public.ensure_profile_invite_code(uuid) from anon;
grant execute on function public.ensure_profile_invite_code(uuid) to authenticated;
grant execute on function public.ensure_profile_invite_code(uuid) to service_role;
revoke execute on function public.create_shareable_moment(uuid, text, jsonb, text) from anon;
grant execute on function public.create_shareable_moment(uuid, text, jsonb, text) to authenticated;
grant execute on function public.create_shareable_moment(uuid, text, jsonb, text) to service_role;
revoke execute on function public.bind_profile_referral(uuid, text, jsonb) from anon;
grant execute on function public.bind_profile_referral(uuid, text, jsonb) to authenticated;
grant execute on function public.bind_profile_referral(uuid, text, jsonb) to service_role;
revoke execute on function public.activate_referral_if_eligible(uuid, text, jsonb) from anon;
grant execute on function public.activate_referral_if_eligible(uuid, text, jsonb) to authenticated;
grant execute on function public.activate_referral_if_eligible(uuid, text, jsonb) to service_role;
revoke execute on function public.consume_runtime_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_runtime_rate_limit(text, integer, integer) to service_role;
revoke execute on function public.emit_active_weekly_title_moments(timestamp with time zone) from anon;
revoke execute on function public.emit_active_weekly_title_moments(timestamp with time zone) from authenticated;
grant execute on function public.emit_active_weekly_title_moments(timestamp with time zone) to service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['profiles', 'votes', 'transactions', 'boosts', 'aura_effects', 'reward_events', 'achievements_catalog', 'user_achievements', 'profile_weekly_titles', 'notification_events', 'notification_preferences', 'leaderboard_presence_states', 'runtime_jobs', 'rate_limit_counters']
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
