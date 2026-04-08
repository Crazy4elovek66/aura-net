-- Admin / ops readiness foundation: moderation state, ops events and useful indexes (2026-04-08)

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

create index if not exists profile_moderation_limited_idx
  on public.profile_moderation_states (is_limited, updated_at desc)
  where is_limited = true;

create index if not exists profile_moderation_discover_idx
  on public.profile_moderation_states (hide_from_discover, updated_at desc)
  where hide_from_discover = true;

create index if not exists profile_moderation_leaderboards_idx
  on public.profile_moderation_states (hide_from_leaderboards, updated_at desc)
  where hide_from_leaderboards = true;

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

create index if not exists ops_events_scope_created_idx
  on public.ops_events (scope, created_at desc);

create index if not exists ops_events_level_created_idx
  on public.ops_events (level, created_at desc);

create index if not exists ops_events_profile_created_idx
  on public.ops_events (profile_id, created_at desc)
  where profile_id is not null;

create index if not exists notification_events_status_created_idx
  on public.notification_events (status, created_at desc);

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
    profile_id,
    is_limited,
    hide_from_discover,
    hide_from_leaderboards,
    reason,
    note,
    updated_by,
    updated_at
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
  returning *
  into v_state;

  insert into public.ops_events (
    level,
    scope,
    event_type,
    profile_id,
    actor_id,
    message,
    payload
  )
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
    select
      v_state.profile_id,
      v_state.is_limited,
      v_state.hide_from_discover,
      v_state.hide_from_leaderboards,
      v_state.reason,
      v_state.note,
      v_state.updated_at;
end;
$$;

revoke execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) from anon;
grant execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) to authenticated;
grant execute on function public.set_profile_moderation_state(uuid, boolean, boolean, boolean, text, text) to service_role;
