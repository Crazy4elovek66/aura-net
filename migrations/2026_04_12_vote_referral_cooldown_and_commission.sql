-- Vote cooldown + referral activity percentage model (2026-04-12)

alter table public.votes
  drop constraint if exists votes_voter_id_target_id_key;

create index if not exists votes_voter_target_created_idx
  on public.votes (voter_id, target_id, created_at desc);

alter table public.referrals
  add column if not exists commission_rate_percent numeric(5,2) not null default 10.00,
  add column if not exists commission_daily_cap integer not null default 20,
  add column if not exists commission_expires_at timestamp with time zone;

alter table public.referrals
  drop constraint if exists referrals_commission_rate_percent_check;

alter table public.referrals
  add constraint referrals_commission_rate_percent_check
  check (commission_rate_percent >= 0 and commission_rate_percent <= 50);

alter table public.referrals
  drop constraint if exists referrals_commission_daily_cap_check;

alter table public.referrals
  add constraint referrals_commission_daily_cap_check
  check (commission_daily_cap >= 0 and commission_daily_cap <= 500);

update public.referrals
set commission_expires_at = joined_at + interval '90 day'
where commission_expires_at is null;

create index if not exists referrals_invitee_commission_idx
  on public.referrals (invitee_id, status, commission_expires_at);

create table if not exists public.referral_activity_commissions (
  id uuid default gen_random_uuid() primary key,
  inviter_id uuid references public.profiles(id) on delete cascade not null,
  invitee_id uuid references public.profiles(id) on delete cascade not null,
  source_transaction_id uuid references public.transactions(id) on delete cascade not null,
  source_type text not null,
  source_amount integer not null,
  commission_amount integer not null,
  rate_percent numeric(5,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (source_transaction_id)
);

alter table public.referral_activity_commissions
  drop constraint if exists referral_activity_commissions_commission_amount_check;

alter table public.referral_activity_commissions
  add constraint referral_activity_commissions_commission_amount_check
  check (commission_amount > 0);

create index if not exists referral_activity_commissions_inviter_created_idx
  on public.referral_activity_commissions (inviter_id, created_at desc);

create index if not exists referral_activity_commissions_invitee_created_idx
  on public.referral_activity_commissions (invitee_id, created_at desc);

alter table public.referral_activity_commissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'referral_activity_commissions' and policyname = 'referral_activity_commissions_select_related'
  ) then
    create policy referral_activity_commissions_select_related on public.referral_activity_commissions
      for select
      using (auth.uid() = inviter_id or auth.uid() = invitee_id);
  end if;
end $$;

create or replace function public.process_referral_activity_commission(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_referral public.referrals%rowtype;
  v_rate numeric(5,2);
  v_raw_commission integer := 0;
  v_used_today integer := 0;
  v_daily_cap integer := 0;
  v_commission integer := 0;
  v_day_start timestamp with time zone;
  v_day_end timestamp with time zone;
  v_inviter_aura_before integer;
  v_inviter_aura_after integer;
begin
  if p_transaction_id is null then
    return;
  end if;

  select *
  into v_tx
  from public.transactions t
  where t.id = p_transaction_id;

  if not found then
    return;
  end if;

  if coalesce(v_tx.metadata->>'voterId', '') = v_referral.inviter_id::text then
    return;
  end if;

  if coalesce(v_tx.amount, 0) <= 0 then
    return;
  end if;

  if v_tx.type not in ('vote_up') then
    return;
  end if;

  if coalesce(v_tx.metadata->>'source', '') = 'referral_activity' then
    return;
  end if;

  select *
  into v_referral
  from public.referrals r
  where r.invitee_id = v_tx.user_id
    and r.status = 'activated'
    and (r.commission_expires_at is null or r.commission_expires_at > coalesce(v_tx.created_at, timezone('utc'::text, now())))
  order by r.activated_at desc nulls last, r.joined_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.profile_moderation_states pms
    where pms.profile_id in (v_referral.inviter_id, v_referral.invitee_id)
      and pms.is_limited = true
  ) then
    return;
  end if;

  v_rate := greatest(least(coalesce(v_referral.commission_rate_percent, 10), 50), 0);
  if v_rate <= 0 then
    return;
  end if;

  v_raw_commission := floor((v_tx.amount::numeric * v_rate) / 100.0);
  if v_raw_commission <= 0 then
    return;
  end if;

  v_daily_cap := greatest(coalesce(v_referral.commission_daily_cap, 20), 0);
  if v_daily_cap = 0 then
    return;
  end if;

  v_day_start := timezone('utc'::text, date_trunc('day', timezone('utc'::text, coalesce(v_tx.created_at, timezone('utc'::text, now())))));
  v_day_end := v_day_start + interval '1 day';

  select coalesce(sum(rac.commission_amount), 0)::integer
  into v_used_today
  from public.referral_activity_commissions rac
  where rac.invitee_id = v_referral.invitee_id
    and rac.created_at >= v_day_start
    and rac.created_at < v_day_end;

  v_commission := least(v_raw_commission, greatest(v_daily_cap - v_used_today, 0));
  if v_commission <= 0 then
    return;
  end if;

  insert into public.referral_activity_commissions (
    inviter_id,
    invitee_id,
    source_transaction_id,
    source_type,
    source_amount,
    commission_amount,
    rate_percent,
    metadata
  )
  values (
    v_referral.inviter_id,
    v_referral.invitee_id,
    v_tx.id,
    v_tx.type,
    v_tx.amount,
    v_commission,
    v_rate,
    jsonb_build_object(
      'source', 'referral_activity',
      'sourceTransactionId', v_tx.id,
      'sourceType', v_tx.type,
      'sourceAmount', v_tx.amount,
      'ratePercent', v_rate,
      'dailyCap', v_daily_cap,
      'usedTodayBefore', v_used_today,
      'sourceCreatedAt', v_tx.created_at
    )
  )
  on conflict (source_transaction_id) do nothing;

  if not found then
    return;
  end if;

  select p.aura_points
  into v_inviter_aura_before
  from public.profiles p
  where p.id = v_referral.inviter_id
  for update;

  if not found then
    delete from public.referral_activity_commissions rac where rac.source_transaction_id = v_tx.id;
    return;
  end if;

  update public.profiles
  set aura_points = aura_points + v_commission
  where id = v_referral.inviter_id
  returning aura_points into v_inviter_aura_after;

  insert into public.transactions (user_id, amount, type, description, metadata)
  values (
    v_referral.inviter_id,
    v_commission,
    'referral_activity_reward',
    format('Процент с активности приглашённого (%s%%)', trim(to_char(v_rate, 'FM990D00'))),
    jsonb_build_object(
      'source', 'referral_activity',
      'inviteeId', v_referral.invitee_id,
      'inviterId', v_referral.inviter_id,
      'ratePercent', v_rate,
      'sourceTransactionId', v_tx.id,
      'sourceType', v_tx.type,
      'sourceAmount', v_tx.amount,
      'commissionAmount', v_commission,
      'dailyCap', v_daily_cap,
      'usedTodayBefore', v_used_today,
      'auraBefore', v_inviter_aura_before,
      'auraAfter', v_inviter_aura_after
    )
  );

  perform public.process_profile_progression(
    v_referral.inviter_id,
    v_inviter_aura_before,
    v_inviter_aura_after,
    jsonb_build_object(
      'source', 'referral_activity',
      'inviteeId', v_referral.invitee_id,
      'sourceTransactionId', v_tx.id,
      'commissionAmount', v_commission,
      'ratePercent', v_rate
    )
  );
exception
  when others then
    raise warning 'process_referral_activity_commission failed for %, reason=%', p_transaction_id, sqlerrm;
    return;
end;
$$;

create or replace function public.on_transaction_insert_referral_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  perform public.process_referral_activity_commission(new.id);
  return new;
end;
$$;

drop trigger if exists trg_transactions_referral_commission on public.transactions;

create trigger trg_transactions_referral_commission
after insert on public.transactions
for each row
execute function public.on_transaction_insert_referral_commission();

drop function if exists public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer);

create or replace function public.cast_profile_vote(
  p_voter_id uuid,
  p_target_id uuid,
  p_vote_type text,
  p_is_anonymous boolean default false,
  p_anonymous_cost integer default 50,
  p_regular_daily_limit integer default 10,
  p_anonymous_daily_limit integer default 2,
  p_pair_cooldown_hours integer default 12
)
returns table (
  vote_id uuid,
  aura_change integer,
  regular_votes_used integer,
  anonymous_votes_used integer,
  voter_aura_left integer,
  target_aura integer,
  next_available_at timestamp with time zone,
  cooldown_hours integer
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
  v_last_pair_vote_at timestamp with time zone;
  v_next_pair_vote_at timestamp with time zone;
  v_pair_cooldown integer := greatest(coalesce(p_pair_cooldown_hours, 12), 1);
  v_lock_key bigint;
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

  v_lock_key := hashtextextended(format('vote-pair:%s:%s', p_voter_id::text, p_target_id::text), 0);
  perform pg_advisory_xact_lock(v_lock_key);

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

  select max(v.created_at)
  into v_last_pair_vote_at
  from public.votes v
  where v.voter_id = p_voter_id
    and v.target_id = p_target_id;

  if v_last_pair_vote_at is not null then
    v_next_pair_vote_at := v_last_pair_vote_at + make_interval(hours => v_pair_cooldown);

    if v_next_pair_vote_at > v_now then
      raise exception 'Vote cooldown active until %',
        to_char(v_next_pair_vote_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    end if;
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
  returning id, created_at into v_vote_id, v_last_pair_vote_at;

  v_next_pair_vote_at := v_last_pair_vote_at + make_interval(hours => v_pair_cooldown);

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
      v_target_aura,
      v_next_pair_vote_at,
      v_pair_cooldown;
end;
$$;

revoke execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer, integer) from anon;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer, integer) to authenticated;
grant execute on function public.cast_profile_vote(uuid, uuid, text, boolean, integer, integer, integer, integer) to service_role;
revoke execute on function public.process_referral_activity_commission(uuid) from public;
revoke execute on function public.process_referral_activity_commission(uuid) from anon;
revoke execute on function public.process_referral_activity_commission(uuid) from authenticated;
grant execute on function public.process_referral_activity_commission(uuid) to service_role;
revoke execute on function public.on_transaction_insert_referral_commission() from public;
revoke execute on function public.on_transaction_insert_referral_commission() from anon;
revoke execute on function public.on_transaction_insert_referral_commission() from authenticated;
grant execute on function public.on_transaction_insert_referral_commission() to service_role;

