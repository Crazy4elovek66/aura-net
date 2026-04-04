-- Meaningful aura spends expansion: decay shield, streak rescue, spotlight visibility and card accents (2026-04-03)

alter table public.profiles
add column if not exists last_streak_save_at timestamp with time zone;

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

create index if not exists aura_effects_profile_type_expires_idx
  on public.aura_effects (profile_id, effect_type, expires_at desc);

create index if not exists aura_effects_active_idx
  on public.aura_effects (effect_type, expires_at desc);

alter table public.aura_effects enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'aura_effects' and policyname = 'aura_effects_select_all'
  ) then
    create policy aura_effects_select_all on public.aura_effects
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'aura_effects' and policyname = 'aura_effects_insert_own'
  ) then
    create policy aura_effects_insert_own on public.aura_effects
      for insert
      with check (auth.uid() = profile_id);
  end if;
end $$;

create or replace function public.purchase_decay_shield(
  p_profile_id uuid,
  p_cost integer default 120,
  p_duration_hours integer default 24
)
returns table (
  expires_at timestamp with time zone,
  aura_left integer
)
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
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to purchase decay shield for another profile';
    end if;
  end if;

  select p.aura_points
  into v_aura_before
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  select ae.expires_at
  into v_active_until
  from public.aura_effects ae
  where ae.profile_id = p_profile_id
    and ae.effect_type = 'DECAY_SHIELD'
    and ae.expires_at > v_now
  order by ae.expires_at desc
  limit 1;

  if v_active_until is not null then
    raise exception 'Decay shield already active until %', v_active_until;
  end if;

  if v_aura_before < v_cost then
    raise exception 'Insufficient aura';
  end if;

  v_expires_at := v_now + make_interval(hours => v_duration);
  v_aura_after := v_aura_before - v_cost;

  update public.profiles
  set aura_points = v_aura_after
  where id = p_profile_id;

  insert into public.aura_effects (
    profile_id,
    effect_type,
    effect_variant,
    starts_at,
    expires_at,
    metadata
  )
  values (
    p_profile_id,
    'DECAY_SHIELD',
    'STANDARD',
    v_now,
    v_expires_at,
    jsonb_build_object(
      'source', 'decay_shield',
      'cost', v_cost,
      'durationHours', v_duration
    )
  );

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'decay_shield_purchase',
    format('Щит от угасания на %s ч', v_duration),
    jsonb_build_object(
      'source', 'decay_shield',
      'cost', v_cost,
      'durationHours', v_duration,
      'expiresAt', v_expires_at,
      'auraBefore', v_aura_before,
      'auraAfter', v_aura_after
    )
  );

  return query
    select v_expires_at, v_aura_after;
end;
$$;

create or replace function public.purchase_card_accent(
  p_profile_id uuid,
  p_variant text,
  p_cost integer default 70,
  p_duration_hours integer default 24
)
returns table (
  effect_variant text,
  expires_at timestamp with time zone,
  aura_left integer
)
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
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to purchase card accent for another profile';
    end if;
  end if;

  if v_variant not in ('NEON_EDGE', 'GOLD_PULSE', 'FROST_RING') then
    raise exception 'Unsupported accent variant: %', v_variant;
  end if;

  select p.aura_points
  into v_aura_before
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  select ae.expires_at, ae.effect_variant
  into v_active_until, v_active_variant
  from public.aura_effects ae
  where ae.profile_id = p_profile_id
    and ae.effect_type = 'CARD_ACCENT'
    and ae.expires_at > v_now
  order by ae.expires_at desc
  limit 1;

  if v_active_until is not null then
    raise exception 'Card accent already active (% until %)', coalesce(v_active_variant, 'UNKNOWN'), v_active_until;
  end if;

  if v_aura_before < v_cost then
    raise exception 'Insufficient aura';
  end if;

  v_expires_at := v_now + make_interval(hours => v_duration);
  v_aura_after := v_aura_before - v_cost;
  v_variant_label :=
    case v_variant
      when 'NEON_EDGE' then 'Неоновая грань'
      when 'GOLD_PULSE' then 'Золотой импульс'
      when 'FROST_RING' then 'Ледяной контур'
      else v_variant
    end;

  update public.profiles
  set aura_points = v_aura_after
  where id = p_profile_id;

  insert into public.aura_effects (
    profile_id,
    effect_type,
    effect_variant,
    starts_at,
    expires_at,
    metadata
  )
  values (
    p_profile_id,
    'CARD_ACCENT',
    v_variant,
    v_now,
    v_expires_at,
    jsonb_build_object(
      'source', 'card_accent',
      'variant', v_variant,
      'cost', v_cost,
      'durationHours', v_duration
    )
  );

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'card_accent_purchase',
    format('Акцент карточки: %s (%s ч)', v_variant_label, v_duration),
    jsonb_build_object(
      'source', 'card_accent',
      'variant', v_variant,
      'variantLabel', v_variant_label,
      'cost', v_cost,
      'durationHours', v_duration,
      'expiresAt', v_expires_at,
      'auraBefore', v_aura_before,
      'auraAfter', v_aura_after
    )
  );

  return query
    select v_variant, v_expires_at, v_aura_after;
end;
$$;

create or replace function public.rescue_streak_with_aura(
  p_profile_id uuid,
  p_cost integer default 90,
  p_cooldown_hours integer default 168
)
returns table (
  last_reward_at timestamp with time zone,
  streak integer,
  aura_left integer,
  cooldown_until timestamp with time zone
)
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
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to rescue streak for another profile';
    end if;
  end if;

  select p.aura_points, p.daily_streak, p.last_reward_at, p.last_streak_save_at
  into v_aura_before, v_streak, v_last_reward_at, v_last_streak_save_at
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  v_streak := coalesce(v_streak, 0);

  if v_streak <= 0 or v_last_reward_at is null then
    raise exception 'No streak to rescue';
  end if;

  v_last_reward_day := (v_last_reward_at at time zone 'utc')::date;

  if v_last_reward_day <> (v_today - 2) then
    raise exception 'Streak rescue is available only after one missed day';
  end if;

  if v_last_streak_save_at is not null then
    v_cooldown_until := v_last_streak_save_at + make_interval(hours => v_cooldown_hours);
    if v_cooldown_until > v_now then
      raise exception 'Streak rescue is on cooldown until %', v_cooldown_until;
    end if;
  end if;

  if v_aura_before < v_cost then
    raise exception 'Insufficient aura';
  end if;

  v_saved_last_reward_at := timezone(
    'utc'::text,
    date_trunc('day', timezone('utc'::text, v_now)) - interval '1 minute'
  );
  v_aura_after := v_aura_before - v_cost;
  v_cooldown_until := v_now + make_interval(hours => v_cooldown_hours);

  update public.profiles
  set aura_points = v_aura_after,
      last_reward_at = v_saved_last_reward_at,
      last_streak_save_at = v_now
  where id = p_profile_id;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_profile_id,
    -v_cost,
    'streak_save',
    'Сохранение серии: страховка 1 пропущенного дня',
    jsonb_build_object(
      'source', 'streak_save',
      'cost', v_cost,
      'streak', v_streak,
      'lastRewardDayBefore', v_last_reward_day,
      'savedLastRewardAt', v_saved_last_reward_at,
      'cooldownHours', v_cooldown_hours,
      'cooldownUntil', v_cooldown_until,
      'auraBefore', v_aura_before,
      'auraAfter', v_aura_after
    )
  );

  return query
    select v_saved_last_reward_at, v_streak, v_aura_after, v_cooldown_until;
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

  v_elapsed_seconds := greatest(extract(epoch from (v_now - v_last_decay_at)), 0);
  v_raw_days := floor(v_elapsed_seconds / 86400);

  if v_raw_days < 1 then
    return 0;
  end if;

  select coalesce(
    sum(
      greatest(
        extract(epoch from least(ae.expires_at, v_now) - greatest(ae.starts_at, v_last_decay_at)),
        0
      )
    ),
    0
  )
  into v_protected_seconds
  from public.aura_effects ae
  where ae.profile_id = p_profile_id
    and ae.effect_type = 'DECAY_SHIELD'
    and ae.expires_at > v_last_decay_at
    and ae.starts_at < v_now;

  v_effective_days := floor(greatest(v_elapsed_seconds - v_protected_seconds, 0) / 86400);

  if v_effective_days < 1 then
    -- Preserve partial unprotected time; otherwise shield windows can wipe accumulated hours.
    return 0;
  end if;

  v_new_aura := floor(v_aura * power(0.97::numeric, v_effective_days));
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
      format('Угасание ауры: %s дн.', v_effective_days),
      jsonb_build_object(
        'daysPassed', v_effective_days,
        'rawDays', v_raw_days,
        'shieldProtectedHours', round((v_protected_seconds / 3600.0)::numeric, 2),
        'ratePerDay', 0.03
      )
    );
  end if;

  return v_aura_to_lose;
end;
$$;

revoke execute on function public.purchase_decay_shield(uuid, integer, integer) from anon;
grant execute on function public.purchase_decay_shield(uuid, integer, integer) to authenticated;
grant execute on function public.purchase_decay_shield(uuid, integer, integer) to service_role;

revoke execute on function public.purchase_card_accent(uuid, text, integer, integer) from anon;
grant execute on function public.purchase_card_accent(uuid, text, integer, integer) to authenticated;
grant execute on function public.purchase_card_accent(uuid, text, integer, integer) to service_role;

revoke execute on function public.rescue_streak_with_aura(uuid, integer, integer) from anon;
grant execute on function public.rescue_streak_with_aura(uuid, integer, integer) to authenticated;
grant execute on function public.rescue_streak_with_aura(uuid, integer, integer) to service_role;

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
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'aura_effects'
  ) then
    alter publication supabase_realtime add table public.aura_effects;
  end if;
end $$;

