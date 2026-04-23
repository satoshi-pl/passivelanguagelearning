-- Tight toggle RPC for favorites.
-- Keeps the hot path to one authoritative DB round-trip.

create or replace function public.toggle_favorite(
  p_user_id uuid,
  p_pair_id uuid,
  p_kind text,
  p_dir text
)
returns boolean
language plpgsql
volatile
as $$
declare
  v_favorited boolean := false;
begin
  if p_kind not in ('word', 'sentence') then
    raise exception 'invalid_favorite_kind';
  end if;

  if p_dir not in ('passive', 'active') then
    raise exception 'invalid_favorite_dir';
  end if;

  delete from public.user_favorites
  where user_id = p_user_id
    and pair_id = p_pair_id
    and kind = p_kind;

  if found then
    return false;
  end if;

  insert into public.user_favorites (
    user_id,
    pair_id,
    kind,
    dir,
    target_lang,
    native_lang
  )
  select
    p_user_id,
    p.id,
    p_kind,
    p_dir,
    lower(btrim(d.target_lang)),
    lower(btrim(d.native_lang))
  from public.pairs p
  join public.decks d
    on d.id = p.deck_id
  where p.id = p_pair_id
    and nullif(btrim(coalesce(d.target_lang, '')), '') is not null
    and nullif(btrim(coalesce(d.native_lang, '')), '') is not null;

  if found then
    v_favorited := true;
    return v_favorited;
  end if;

  if exists (
    select 1
    from public.pairs p
    where p.id = p_pair_id
  ) then
    raise exception 'deck_not_found_for_pair';
  end if;

  raise exception 'pair_not_found';
end;
$$;
