-- Retention stage: daily reward, streak, vote limits and leaderboard support (2026-03-31)

create index if not exists votes_voter_created_idx on public.votes (voter_id, created_at desc);
create index if not exists votes_voter_anon_created_idx on public.votes (voter_id, created_at desc) where is_anonymous = true;
create index if not exists transactions_positive_created_idx on public.transactions (created_at desc) where amount > 0;

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
    format('Ежедневная награда: день %s', v_streak),
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

revoke execute on function public.claim_daily_reward(uuid) from anon;
grant execute on function public.claim_daily_reward(uuid) to authenticated;
grant execute on function public.claim_daily_reward(uuid) to service_role;

revoke execute on function public.get_growth_leaderboard(integer, integer) from anon;
grant execute on function public.get_growth_leaderboard(integer, integer) to authenticated;
grant execute on function public.get_growth_leaderboard(integer, integer) to service_role;
