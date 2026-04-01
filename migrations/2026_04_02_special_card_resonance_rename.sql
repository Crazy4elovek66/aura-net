update public.profiles
set special_card = 'RESONANCE'
where special_card = 'CURATOR';

alter table public.profiles
  drop constraint if exists profiles_special_card_check;

alter table public.profiles
  add constraint profiles_special_card_check
  check (special_card is null or special_card in ('RESONANCE'));

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
