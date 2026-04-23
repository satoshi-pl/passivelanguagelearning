-- Tight write RPC for pair-progress.
-- Keeps the hot path to one authoritative DB round-trip.

create or replace function public.write_pair_progress(
  p_user_id uuid,
  p_pair_id uuid,
  p_kind text,
  p_dir text
)
returns void
language plpgsql
volatile
as $$
declare
  v_now timestamptz := now();
begin
  if p_kind not in ('word', 'sentence') then
    raise exception 'invalid_progress_kind';
  end if;

  if p_dir not in ('passive', 'active') then
    raise exception 'invalid_progress_dir';
  end if;

  insert into public.user_pairs (
    user_id,
    pair_id,
    deck_id,
    word_mastered_at,
    sentence_mastered_at,
    word_active_mastered_at,
    sentence_active_mastered_at
  )
  select
    p_user_id,
    p.id,
    p.deck_id,
    case when p_dir = 'passive' and p_kind = 'word' then v_now else null end,
    case when p_dir = 'passive' and p_kind = 'sentence' then v_now else null end,
    case when p_dir = 'active' and p_kind = 'word' then v_now else null end,
    case when p_dir = 'active' and p_kind = 'sentence' then v_now else null end
  from public.pairs p
  where p.id = p_pair_id
    and (
      p_kind <> 'sentence'
      or (
        nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null
      )
    )
  on conflict (user_id, deck_id, pair_id)
  do update set
    word_mastered_at = case
      when p_dir = 'passive' and p_kind = 'word' then v_now
      else public.user_pairs.word_mastered_at
    end,
    sentence_mastered_at = case
      when p_dir = 'passive' and p_kind = 'sentence' then v_now
      else public.user_pairs.sentence_mastered_at
    end,
    word_active_mastered_at = case
      when p_dir = 'active' and p_kind = 'word' then v_now
      else public.user_pairs.word_active_mastered_at
    end,
    sentence_active_mastered_at = case
      when p_dir = 'active' and p_kind = 'sentence' then v_now
      else public.user_pairs.sentence_active_mastered_at
    end;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.pairs p
    where p.id = p_pair_id
  ) then
    raise exception 'sentence_unavailable';
  end if;

  raise exception 'pair_not_found';
end;
$$;
