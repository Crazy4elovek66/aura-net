-- Atomic vote and boost mutations: prevent duplicate charges, race conditions and partial writes (2026-04-08)

create or replace function public.activate_profile_boost(
  p_profile_id uuid,
  p_cost integer default 200,
  p_duration_minutes integer default 15
)
returns table (
  boost_id uuid,
  expires_at timestamp with time zone,
  aura_left integer
)
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
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_profile_id then
      raise exception 'Not allowed to activate boost for another profile';
    end if;
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_profile_id;
  end if;

  select b.expires_at
  into v_active_until
  from public.boosts b
  where b.profile_id = p_profile_id
    and b.expires_at > v_now
  order by b.expires_at desc
  limit 1;

  if v_active_until is not null then
    raise exception 'Boost already active until %', v_active_until;
  end if;

  if coalesce(v_profile.aura_points, 0) < v_cost then
    raise exception 'Insufficient aura';
  end if;

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
    jsonb_build_object(
      'source', 'spotlight',
      'boostId', v_boost_id,
      'durationMinutes', v_duration,
      'expiresAt', v_expires_at,
      'auraBefore', v_profile.aura_points,
      'auraAfter', v_aura_left
    )
  );

  return query
    select v_boost_id, v_expires_at, v_aura_left;
end;
$$;

create or replace function public.cast_profile_vote(
  p_voter_id uuid,
  p_target_id uuid,
  p_vote_type text,
  p_is_anonymous boolean default false,
  p_anonymous_cost integer default 50,
  p_regular_daily_limit integer default 10,
  p_anonymous_daily_limit integer default 2
)
returns table (
  vote_id uuid,
  aura_change integer,
  regular_votes_used integer,
  anonymous_votes_used integer,
  voter_aura_left integer,
  target_aura integer
)
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
  if p_voter_id is null then
    raise exception 'Voter id is required';
  end if;

  if p_target_id is null then
    raise exception 'Target id is required';
  end if;

  if auth.role() <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_voter_id then
      raise exception 'Not allowed to vote for another profile';
    end if;
  end if;

  if v_type not in ('up', 'down') then
    raise exception 'Invalid vote type: %', coalesce(p_vote_type, '<null>');
  end if;

  if p_voter_id = p_target_id then
    raise exception 'Self vote forbidden';
  end if;

  select *
  into v_voter
  from public.profiles p
  where p.id = p_voter_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_voter_id;
  end if;

  select *
  into v_target
  from public.profiles p
  where p.id = p_target_id
  for update;

  if not found then
    raise exception 'Profile not found for id %', p_target_id;
  end if;

  if exists (
    select 1
    from public.votes v
    where v.voter_id = p_voter_id
      and v.target_id = p_target_id
  ) then
    raise exception 'Already voted for target';
  end if;

  select
    count(*) filter (where v.is_anonymous = false)::integer,
    count(*) filter (where v.is_anonymous = true)::integer
  into v_regular_used, v_anonymous_used
  from public.votes v
  where v.voter_id = p_voter_id
    and v.created_at >= v_day_start
    and v.created_at < v_day_end;

  if coalesce(p_is_anonymous, false) then
    if v_anonymous_used >= greatest(coalesce(p_anonymous_daily_limit, 2), 0) then
      raise exception 'Anonymous vote daily limit reached';
    end if;

    if coalesce(v_voter.aura_points, 0) < greatest(coalesce(p_anonymous_cost, 50), 0) then
      raise exception 'Insufficient aura';
    end if;

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
      jsonb_build_object(
        'source', 'vote',
        'anonymous', true,
        'targetId', p_target_id,
        'cost', greatest(coalesce(p_anonymous_cost, 50), 0),
        'auraBefore', v_voter.aura_points,
        'auraAfter', v_voter_aura_left
      )
    );
  else
    if v_regular_used >= greatest(coalesce(p_regular_daily_limit, 10), 0) then
      raise exception 'Regular vote daily limit reached';
    end if;

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
      jsonb_build_object(
        'source', 'vote',
        'voteId', v_vote_id,
        'voterId', p_voter_id,
        'anonymous', coalesce(p_is_anonymous, false)
      )
    );
  end if;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    p_target_id,
    v_aura_change,
    case when v_type = 'up' then 'vote_up' else 'vote_down' end,
    case when v_type = 'up' then 'Получен плюс-аура голос' else 'Получен минус-аура голос' end,
    jsonb_build_object(
      'source', 'vote',
      'voteId', v_vote_id,
      'voterId', p_voter_id,
      'anonymous', coalesce(p_is_anonymous, false),
      'auraBefore', v_target.aura_points,
      'auraAfter', v_target_aura
    )
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

revoke execute on function public.activate_profile_boost(uuid, integer, integer) from anon;
grant execute on function public.activate_profile_boost(uuid, integer, integer) to authenticated;
grant execute on function public.activate_profile_boost(uuid, integer, integer) to service_role;

revoke execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) from anon;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) to authenticated;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer) to service_role;
