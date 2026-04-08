-- Runtime reliability uplift: persistent retries, distributed rate limit and follow-up jobs (2026-04-08)

alter table public.notification_events
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamp with time zone,
  add column if not exists processing_started_at timestamp with time zone,
  add column if not exists last_error_code text;

create index if not exists notification_events_status_schedule_processing_idx
  on public.notification_events (status, scheduled_for asc, processing_started_at asc);

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

create index if not exists runtime_jobs_queue_idx
  on public.runtime_jobs (status, scheduled_for asc, processing_started_at asc, created_at asc);

create index if not exists runtime_jobs_type_status_idx
  on public.runtime_jobs (job_type, status, created_at desc);

create table if not exists public.rate_limit_counters (
  bucket_key text primary key,
  window_started_at timestamp with time zone not null,
  window_ends_at timestamp with time zone not null,
  hits integer not null default 0,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_ends_at asc, updated_at asc);

alter table public.runtime_jobs enable row level security;
alter table public.rate_limit_counters enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'runtime_jobs' and policyname = 'runtime_jobs_service_role_only'
  ) then
    create policy runtime_jobs_service_role_only on public.runtime_jobs
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'rate_limit_counters' and policyname = 'rate_limit_counters_service_role_only'
  ) then
    create policy rate_limit_counters_service_role_only on public.rate_limit_counters
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create or replace function public.consume_runtime_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  limit_count integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamp with time zone,
  current_hits integer
)
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

revoke execute on function public.consume_runtime_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_runtime_rate_limit(text, integer, integer) to service_role;
