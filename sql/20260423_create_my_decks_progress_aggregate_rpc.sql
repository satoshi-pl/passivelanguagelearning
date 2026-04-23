-- My Decks first paint only needs deck-level progress totals.
-- Keep this aggregate narrow so the loader avoids broad row scans.

create or replace function public.get_my_decks_progress_aggregates(
  p_user_id uuid,
  p_target_lang text,
  p_native_lang text
)
returns table (
  deck_id uuid,
  total_pairs bigint,
  words_mastered bigint,
  sentences_mastered bigint
)
language sql
stable
as $$
  with scoped_decks as (
    select d.id
    from public.decks d
    where lower(coalesce(d.target_lang, '')) = lower(coalesce(p_target_lang, ''))
      and lower(coalesce(d.native_lang, '')) = lower(coalesce(p_native_lang, ''))
  )
  select
    d.id as deck_id,
    count(p.id)::bigint as total_pairs,
    count(*) filter (where p.id is not null and up.word_mastered_at is not null)::bigint as words_mastered,
    count(*) filter (where p.id is not null and up.sentence_mastered_at is not null)::bigint as sentences_mastered
  from scoped_decks d
  left join public.pairs p
    on p.deck_id = d.id
  left join public.user_pairs up
    on up.user_id = p_user_id
   and up.deck_id = d.id
   and up.pair_id = p.id
  group by d.id;
$$;
