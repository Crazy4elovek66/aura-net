alter table public.profiles add column if not exists special_card text;

alter table public.profiles
  drop constraint if exists profiles_special_card_check;

alter table public.profiles
  add constraint profiles_special_card_check
  check (special_card is null or special_card in ('RESONANCE'));

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.platform_admins enable row level security;

insert into public.platform_admins (user_id)
select p.id
from public.profiles p
where p.username = 'id1'
on conflict (user_id) do nothing;

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

revoke execute on function public.is_platform_admin(uuid) from anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;

revoke execute on function public.set_profile_special_card(uuid, text) from anon;
grant execute on function public.set_profile_special_card(uuid, text) to authenticated;
grant execute on function public.set_profile_special_card(uuid, text) to service_role;
