-- Pre-launch loops infrastructure: Telegram delivery, referrals, shareable moments and economy rebalance (2026-04-08)

alter table public.profiles
  add column if not exists telegram_id bigint,
  add column if not exists invite_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

update public.profiles p
set telegram_id = nullif(u.raw_user_meta_data->>'telegram_id', '')::bigint
from auth.users u
where u.id = p.id
  and p.telegram_id is null
  and nullif(u.raw_user_meta_data->>'telegram_id', '') is not null;

create unique index if not exists profiles_invite_code_idx
  on public.profiles (invite_code)
  where invite_code is not null;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

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

create index if not exists referrals_inviter_status_idx
  on public.referrals (inviter_id, status, joined_at desc);

create index if not exists referrals_invitee_status_idx
  on public.referrals (invitee_id, status, joined_at desc);

create table if not exists public.shareable_moments (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  moment_type text not null,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  shared_at timestamp with time zone
);

create unique index if not exists shareable_moments_profile_dedupe_idx
  on public.shareable_moments (profile_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists shareable_moments_profile_created_idx
  on public.shareable_moments (profile_id, created_at desc);

alter table public.referrals enable row level security;
alter table public.shareable_moments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'referrals' and policyname = 'referrals_select_related'
  ) then
    create policy referrals_select_related on public.referrals
      for select
      using (auth.uid() = inviter_id or auth.uid() = invitee_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'shareable_moments' and policyname = 'shareable_moments_select_own'
  ) then
    create policy shareable_moments_select_own on public.shareable_moments
      for select
      using (auth.uid() = profile_id);
  end if;
end $$;

create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select lower(encode(gen_random_bytes(6), 'hex'));
$$;

create or replace function public.ensure_profile_invite_code(
  p_profile_id uuid
)
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

  select p.invite_code
  into v_existing
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  if nullif(btrim(coalesce(v_existing, '')), '') is not null then
    return v_existing;
  end if;

  loop
    v_candidate := public.generate_invite_code();

    exit when not exists (
      select 1
      from public.profiles p
      where p.invite_code = v_candidate
    );
  end loop;

  update public.profiles
  set invite_code = v_candidate
  where id = p_profile_id;

  return v_candidate;
end;
$$;

do $$
declare
  v_profile_id uuid;
  v_candidate text;
begin
  for v_profile_id in
    select p.id
    from public.profiles p
    where p.invite_code is null
  loop
    loop
      v_candidate := public.generate_invite_code();
      exit when not exists (
        select 1
        from public.profiles p
        where p.invite_code = v_candidate
      );
    end loop;

    update public.profiles
    set invite_code = v_candidate
    where id = v_profile_id
      and invite_code is null;
  end loop;
end $$;

create or replace function public.create_shareable_moment(
  p_profile_id uuid,
  p_moment_type text,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns table (
  created boolean,
  moment_id uuid
)
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

  insert into public.shareable_moments (
    profile_id,
    moment_type,
    dedupe_key,
    payload
  )
  values (
    p_profile_id,
    p_moment_type,
    v_dedupe_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (profile_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_moment_id;

  if v_moment_id is null then
    return query
      select false, null::uuid;
    return;
  end if;

  return query
    select true, v_moment_id;
end;
$$;

create or replace function public.bind_profile_referral(
  p_invitee_id uuid,
  p_invite_code text,
  p_context jsonb default '{}'::jsonb
)
returns table (
  bound boolean,
  inviter_id uuid,
  status text,
  reason text
)
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
  if p_invitee_id is null then
    raise exception 'Invitee id is required';
  end if;

  if v_code is null then
    return query
      select false, null::uuid, 'skipped'::text, 'missing_invite_code'::text;
    return;
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_invitee_id then
      raise exception 'Not allowed to bind referral for another profile';
    end if;
  end if;

  select *
  into v_invitee
  from public.profiles p
  where p.id = p_invitee_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_invitee_id;
  end if;

  select *
  into v_inviter
  from public.profiles p
  where p.invite_code = v_code;

  if not found then
    return query
      select false, null::uuid, 'rejected'::text, 'invite_code_not_found'::text;
    return;
  end if;

  if v_inviter.id = p_invitee_id then
    return query
      select false, v_inviter.id, 'rejected'::text, 'self_referral'::text;
    return;
  end if;

  if v_invitee.referred_by is not null and v_invitee.referred_by <> v_inviter.id then
    return query
      select false, v_invitee.referred_by, 'rejected'::text, 'already_referred'::text;
    return;
  end if;

  if v_invitee.telegram_id is not null and v_inviter.telegram_id is not null and v_invitee.telegram_id = v_inviter.telegram_id then
    return query
      select false, v_inviter.id, 'rejected'::text, 'same_telegram_identity'::text;
    return;
  end if;

  if v_invitee.created_at < timezone('utc'::text, now()) - interval '3 day' then
    return query
      select false, v_inviter.id, 'rejected'::text, 'invite_window_expired'::text;
    return;
  end if;

  select exists (
    select 1
    from public.votes v
    where v.voter_id = p_invitee_id
       or v.target_id = p_invitee_id
  ) or exists (
    select 1
    from public.transactions t
    where t.user_id = p_invitee_id
      and t.type in ('daily_reward', 'vote_up', 'vote_down', 'streak_milestone', 'weekly_activity_reward')
  )
  into v_has_activity;

  if v_has_activity then
    return query
      select false, v_inviter.id, 'rejected'::text, 'invitee_already_active'::text;
    return;
  end if;

  select *
  into v_existing
  from public.referrals r
  where r.invitee_id = p_invitee_id;

  update public.profiles
  set referred_by = v_inviter.id
  where id = p_invitee_id
    and referred_by is null;

  insert into public.referrals (
    inviter_id,
    invitee_id,
    invite_code,
    status,
    metadata
  )
  values (
    v_inviter.id,
    p_invitee_id,
    v_code,
    'pending',
    coalesce(p_context, '{}'::jsonb)
  )
  on conflict (invitee_id) do update
  set inviter_id = excluded.inviter_id,
      invite_code = excluded.invite_code,
      status = case when public.referrals.status = 'activated' then public.referrals.status else 'pending' end,
      metadata = public.referrals.metadata || excluded.metadata;

  return query
    select true, v_inviter.id, 'pending'::text, case when v_existing.id is null then 'bound' else 'updated' end::text;
end;
$$;

create or replace function public.activate_referral_if_eligible(
  p_invitee_id uuid,
  p_source text default 'activity',
  p_context jsonb default '{}'::jsonb
)
returns table (
  activated boolean,
  inviter_id uuid,
  invitee_id uuid,
  inviter_reward integer,
  invitee_reward integer,
  reason text
)
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
  if p_invitee_id is null then
    raise exception 'Invitee id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_invitee_id then
      raise exception 'Not allowed to activate referral for another profile';
    end if;
  end if;

  select *
  into v_referral
  from public.referrals r
  where r.invitee_id = p_invitee_id
  for update;

  if not found then
    return query
      select false, null::uuid, p_invitee_id, 0, 0, 'referral_missing'::text;
    return;
  end if;

  if v_referral.status = 'activated' then
    return query
      select true, v_referral.inviter_id, p_invitee_id, v_referral.inviter_reward, v_referral.invitee_reward, 'already_activated'::text;
    return;
  end if;

  select exists (
    select 1
    from public.transactions t
    where t.user_id = p_invitee_id
      and t.type = 'daily_reward'
  )
  into v_has_claim;

  select exists (
    select 1
    from public.votes v
    where (v.voter_id = p_invitee_id and v.target_id <> v_referral.inviter_id)
       or (v.target_id = p_invitee_id and v.voter_id is not null and v.voter_id <> v_referral.inviter_id)
  )
  into v_has_social_action;

  if not v_has_claim then
    return query
      select false, v_referral.inviter_id, p_invitee_id, 0, 0, 'waiting_first_claim'::text;
    return;
  end if;

  if not v_has_social_action then
    return query
      select false, v_referral.inviter_id, p_invitee_id, 0, 0, 'waiting_social_proof'::text;
    return;
  end if;

  select e.granted, e.reward
  into v_reward_granted, v_inviter_reward
  from public.grant_event_reward_once(
    v_referral.inviter_id,
    format('referral_inviter_%s', p_invitee_id::text),
    'global',
    25,
    'referral_inviter_reward',
    'Награда за активированного приглашённого',
    coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
      'source', 'referral_activation',
      'inviteeId', p_invitee_id,
      'inviterId', v_referral.inviter_id
    )
  ) e;

  select e.reward
  into v_invitee_reward
  from public.grant_event_reward_once(
    p_invitee_id,
    format('referral_invitee_%s', v_referral.inviter_id::text),
    'global',
    10,
    'referral_invitee_reward',
    'Бонус за вход по приглашению',
    coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
      'source', 'referral_activation',
      'inviteeId', p_invitee_id,
      'inviterId', v_referral.inviter_id
    )
  ) e;

  update public.referrals
  set status = 'activated',
      activated_at = timezone('utc'::text, now()),
      activation_source = nullif(btrim(coalesce(p_source, '')), ''),
      inviter_reward = coalesce(v_inviter_reward, 0),
      invitee_reward = coalesce(v_invitee_reward, 0),
      metadata = public.referrals.metadata || coalesce(p_context, '{}'::jsonb)
  where invitee_id = p_invitee_id;

  perform 1
  from public.create_shareable_moment(
    v_referral.inviter_id,
    'referral_activated',
    jsonb_build_object(
      'inviteeId', p_invitee_id,
      'inviterReward', coalesce(v_inviter_reward, 0)
    ),
    format('referral-activated:%s', p_invitee_id::text)
  );

  return query
    select true, v_referral.inviter_id, p_invitee_id, coalesce(v_inviter_reward, 0), coalesce(v_invitee_reward, 0), 'activated'::text;
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
  elsif v_profile.telegram_id is null then
    v_allowed := false;
    v_status := 'skipped';
    v_reason := 'telegram_id_missing';
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

    perform 1
    from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'hero',
        'tierLabel', 'Герой',
        'threshold', 501,
        'fromAura', coalesce(p_previous_aura, 0),
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier:hero'
    );

    perform 1
    from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'hero',
        'tierLabel', 'Герой',
        'threshold', 501,
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier-reached:hero',
      'telegram'
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

  if coalesce(p_previous_aura, 0) < 2001 and coalesce(p_current_aura, 0) >= 2001 then
    perform 1
    from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'that_one',
        'tierLabel', 'Тот самый',
        'threshold', 2001,
        'fromAura', coalesce(p_previous_aura, 0),
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier:that_one'
    );

    perform 1
    from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'that_one',
        'tierLabel', 'Тот самый',
        'threshold', 2001,
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier-reached:that_one',
      'telegram'
    );
  end if;

  if coalesce(p_previous_aura, 0) < 5001 and coalesce(p_current_aura, 0) >= 5001 then
    perform 1
    from public.create_shareable_moment(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'sigma',
        'tierLabel', 'Сигма',
        'threshold', 5001,
        'fromAura', coalesce(p_previous_aura, 0),
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier:sigma'
    );

    perform 1
    from public.enqueue_notification_event(
      p_profile_id,
      'tier_reached',
      jsonb_build_object(
        'tierKey', 'sigma',
        'tierLabel', 'Сигма',
        'threshold', 5001,
        'toAura', coalesce(p_current_aura, 0)
      ),
      'tier-reached:sigma',
      'telegram'
    );
  end if;
end;
$$;

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

  perform 1
  from public.create_shareable_moment(
    p_profile_id,
    'achievement_unlocked',
    jsonb_build_object(
      'achievementKey', v_achievement.key,
      'achievementTitle', v_achievement.title,
      'reward', v_reward
    ),
    format('achievement:%s', v_achievement.key)
  );

  return query
    select true, v_reward, v_achievement.title;
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
      format('leaderboard-entered-top10:%s:%s', p_profile_id::text, v_rank::text),
      'telegram'
    );

    perform 1
    from public.create_shareable_moment(
      p_profile_id,
      'leaderboard_top10_entered',
      jsonb_build_object(
        'rank', v_rank,
        'previousRank', v_prev_rank
      ),
      'leaderboard-top10-entered'
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
      format('leaderboard-dropped-top10:%s:%s', p_profile_id::text, v_rank::text),
      'telegram'
    );
  end if;

  return query
    select v_rank, v_in_top10, (v_in_top10 and not coalesce(v_prev_in_top10, false)), (not v_in_top10 and coalesce(v_prev_in_top10, false));
end;
$$;

create or replace function public.emit_active_weekly_title_moments(
  p_reference timestamp with time zone default timezone('utc'::text, now())
)
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
    select
      pwt.profile_id,
      pwt.title_key,
      wtc.title,
      pwt.week_start,
      pwt.week_end,
      pwt.score
    from public.profile_weekly_titles pwt
    join public.weekly_titles_catalog wtc on wtc.key = pwt.title_key
    where pwt.is_active = true
      and pwt.week_end > (coalesce(p_reference, timezone('utc'::text, now())) at time zone 'utc')::date
  loop
    v_week_scope := v_row.week_start::text;

    perform 1
    from public.create_shareable_moment(
      v_row.profile_id,
      'weekly_title_awarded',
      jsonb_build_object(
        'titleKey', v_row.title_key,
        'title', v_row.title,
        'weekStart', v_row.week_start,
        'weekEnd', v_row.week_end,
        'score', v_row.score
      ),
      format('weekly-title:%s:%s', v_row.title_key, v_week_scope)
    );

    perform 1
    from public.enqueue_notification_event(
      v_row.profile_id,
      'weekly_title_awarded',
      jsonb_build_object(
        'titleKey', v_row.title_key,
        'title', v_row.title,
        'weekStart', v_row.week_start,
        'weekEnd', v_row.week_end,
        'score', v_row.score
      ),
      format('weekly-title-notify:%s:%s', v_row.title_key, v_week_scope),
      'telegram'
    );
  end loop;
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
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

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
    raise exception 'Profile not found';
  end if;

  v_streak := coalesce(v_streak, 0);
  v_previous_reward_day := case when v_previous_reward_at is null then null else (v_previous_reward_at at time zone 'utc')::date end;
  v_available_at := timezone('utc'::text, date_trunc('day', timezone('utc'::text, v_now)) + interval '1 day');

  if v_previous_reward_day = v_today then
    v_next_reward := least(8 + (greatest(v_streak, 0) * 2), 18);
    return query
      select false, 0, greatest(v_streak, 0), v_next_reward, v_previous_reward_at, v_available_at, 0, 0, 0, 0, 0, array[]::text[];
    return;
  end if;

  if v_previous_reward_day = (v_today - 1) then
    v_streak := greatest(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  v_base_reward := least(8 + ((v_streak - 1) * 2), 18);
  v_next_reward := least(8 + (v_streak * 2), 18);

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
      'nextReward', v_next_reward,
      'rewardRole', 'supporting'
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

        perform 1
        from public.create_shareable_moment(
          p_profile_id,
          'streak_milestone',
          jsonb_build_object(
            'milestoneDays', v_milestones[v_index],
            'streak', v_streak,
            'reward', v_milestone_rewards[v_index]
          ),
          format('streak-milestone:%s', v_milestones[v_index])
        );
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
      8,
      'weekly_activity_reward',
      format('Недельная награда за активность (%s/7 дней)', v_weekly_active_days),
      jsonb_build_object(
        'source', 'weekly_activity',
        'weekStart', v_week_scope,
        'activeDays', v_weekly_active_days,
        'requiredDays', 5,
        'reward', 8
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

revoke execute on function public.emit_active_weekly_title_moments(timestamp with time zone) from anon;
revoke execute on function public.emit_active_weekly_title_moments(timestamp with time zone) from authenticated;
grant execute on function public.emit_active_weekly_title_moments(timestamp with time zone) to service_role;
