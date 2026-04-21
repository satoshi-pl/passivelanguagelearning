-- Compact aggregate RPCs for dashboard/review/favorites pages.
-- These reduce broad row payloads and move counting/grouping to Postgres.

create or replace function public.get_passive_dashboard_aggregates(
  p_user_id uuid,
  p_deck_id uuid
)
returns table (
  category text,
  total_pairs bigint,
  words_mastered bigint,
  sentences_mastered bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      nullif(btrim(p.category), '') as category,
      (up.word_mastered_at is not null) as word_mastered,
      (up.sentence_mastered_at is not null) as sentence_mastered
    from public.pairs p
    left join public.user_pairs up
      on up.user_id = p_user_id
     and up.deck_id = p_deck_id
     and up.pair_id = p.id
    where p.deck_id = p_deck_id
  )
  select
    null::text as category,
    count(*)::bigint as total_pairs,
    count(*) filter (where word_mastered)::bigint as words_mastered,
    count(*) filter (where sentence_mastered)::bigint as sentences_mastered
  from base
  union all
  select
    category,
    count(*)::bigint as total_pairs,
    count(*) filter (where word_mastered)::bigint as words_mastered,
    count(*) filter (where sentence_mastered)::bigint as sentences_mastered
  from base
  where category is not null
  group by category;
$$;

create or replace function public.get_active_dashboard_aggregates(
  p_user_id uuid,
  p_deck_id uuid
)
returns table (
  category text,
  words_total bigint,
  words_done bigint,
  words_pending bigint,
  sentences_total bigint,
  sentences_done bigint,
  sentences_pending bigint,
  ws_total_pairs bigint,
  ws_pending_pairs bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      nullif(btrim(p.category), '') as category,
      (nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null) as sentence_exists,
      (up.word_mastered_at is not null) as word_unlocked,
      (up.word_mastered_at is not null and up.word_active_mastered_at is not null) as word_done,
      (up.word_mastered_at is not null and up.word_active_mastered_at is null) as word_pending,
      (up.sentence_mastered_at is not null) as sentence_unlocked,
      (up.sentence_mastered_at is not null and up.sentence_active_mastered_at is not null) as sentence_done,
      ((nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null)
        and up.sentence_mastered_at is not null
        and up.sentence_active_mastered_at is null) as sentence_pending
    from public.pairs p
    left join public.user_pairs up
      on up.user_id = p_user_id
     and up.deck_id = p_deck_id
     and up.pair_id = p.id
    where p.deck_id = p_deck_id
  ),
  scored as (
    select
      *,
      (word_unlocked or (sentence_exists and sentence_unlocked)) as ws_unlocked,
      (word_pending or sentence_pending) as ws_pending
    from base
  )
  select
    null::text as category,
    count(*) filter (where word_unlocked)::bigint as words_total,
    count(*) filter (where word_done)::bigint as words_done,
    count(*) filter (where word_pending)::bigint as words_pending,
    count(*) filter (where sentence_unlocked)::bigint as sentences_total,
    count(*) filter (where sentence_done)::bigint as sentences_done,
    count(*) filter (where sentence_pending)::bigint as sentences_pending,
    count(*) filter (where ws_unlocked)::bigint as ws_total_pairs,
    count(*) filter (where ws_pending)::bigint as ws_pending_pairs
  from scored
  union all
  select
    category,
    count(*) filter (where word_unlocked)::bigint as words_total,
    count(*) filter (where word_done)::bigint as words_done,
    count(*) filter (where word_pending)::bigint as words_pending,
    count(*) filter (where sentence_unlocked)::bigint as sentences_total,
    count(*) filter (where sentence_done)::bigint as sentences_done,
    count(*) filter (where sentence_pending)::bigint as sentences_pending,
    count(*) filter (where ws_unlocked)::bigint as ws_total_pairs,
    count(*) filter (where ws_pending)::bigint as ws_pending_pairs
  from scored
  where category is not null
  group by category;
$$;

create or replace function public.get_passive_review_aggregates(
  p_user_id uuid,
  p_deck_id uuid
)
returns table (
  category text,
  words_reviewable bigint,
  sentences_reviewable bigint,
  ws_reviewable bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      nullif(btrim(p.category), '') as category,
      (nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null) as sentence_exists,
      (up.word_mastered_at is not null) as has_word,
      (up.sentence_mastered_at is not null) as has_sentence
    from public.pairs p
    left join public.user_pairs up
      on up.user_id = p_user_id
     and up.deck_id = p_deck_id
     and up.pair_id = p.id
    where p.deck_id = p_deck_id
  ),
  scored as (
    select
      *,
      (sentence_exists and has_sentence) as has_sentence_review,
      (has_word or (sentence_exists and has_sentence)) as has_ws
    from base
  )
  select
    null::text as category,
    count(*) filter (where has_word)::bigint as words_reviewable,
    count(*) filter (where has_sentence_review)::bigint as sentences_reviewable,
    count(*) filter (where has_ws)::bigint as ws_reviewable
  from scored
  union all
  select
    category,
    count(*) filter (where has_word)::bigint as words_reviewable,
    count(*) filter (where has_sentence_review)::bigint as sentences_reviewable,
    count(*) filter (where has_ws)::bigint as ws_reviewable
  from scored
  where category is not null
  group by category;
$$;

create or replace function public.get_active_review_aggregates(
  p_user_id uuid,
  p_deck_id uuid
)
returns table (
  category text,
  words_reviewable bigint,
  sentences_reviewable bigint,
  ws_reviewable bigint
)
language sql
stable
as $$
  with base as (
    select
      p.id,
      nullif(btrim(p.category), '') as category,
      (nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null) as sentence_exists,
      (up.word_active_mastered_at is not null) as has_word,
      (up.sentence_active_mastered_at is not null) as has_sentence
    from public.pairs p
    left join public.user_pairs up
      on up.user_id = p_user_id
     and up.deck_id = p_deck_id
     and up.pair_id = p.id
    where p.deck_id = p_deck_id
  ),
  scored as (
    select
      *,
      (sentence_exists and has_sentence) as has_sentence_review,
      (has_word or (sentence_exists and has_sentence)) as has_ws
    from base
  )
  select
    null::text as category,
    count(*) filter (where has_word)::bigint as words_reviewable,
    count(*) filter (where has_sentence_review)::bigint as sentences_reviewable,
    count(*) filter (where has_ws)::bigint as ws_reviewable
  from scored
  union all
  select
    category,
    count(*) filter (where has_word)::bigint as words_reviewable,
    count(*) filter (where has_sentence_review)::bigint as sentences_reviewable,
    count(*) filter (where has_ws)::bigint as ws_reviewable
  from scored
  where category is not null
  group by category;
$$;

create or replace function public.get_favorites_aggregates(
  p_user_id uuid,
  p_target_lang text,
  p_native_lang text
)
returns table (
  category text,
  words_total bigint,
  sentences_total bigint,
  ws_total bigint,
  total_favorites bigint
)
language sql
stable
as $$
  with fav as (
    select
      f.pair_id,
      f.kind,
      nullif(btrim(p.category), '') as category,
      (nullif(btrim(coalesce(p.sentence_target, '')), '') is not null
        and nullif(btrim(coalesce(p.sentence_native, '')), '') is not null) as sentence_exists
    from public.user_favorites f
    join public.pairs p on p.id = f.pair_id
    where f.user_id = p_user_id
      and f.target_lang = p_target_lang
      and f.native_lang = p_native_lang
  ),
  scored as (
    select
      *,
      (kind = 'word') as counts_word,
      (kind = 'sentence' and sentence_exists) as counts_sentence,
      ((kind = 'word') or (kind = 'sentence' and sentence_exists)) as counts_ws
    from fav
  )
  select
    null::text as category,
    count(*) filter (where counts_word)::bigint as words_total,
    count(*) filter (where counts_sentence)::bigint as sentences_total,
    count(*) filter (where counts_ws)::bigint as ws_total,
    count(*)::bigint as total_favorites
  from scored
  union all
  select
    category,
    count(*) filter (where counts_word)::bigint as words_total,
    count(*) filter (where counts_sentence)::bigint as sentences_total,
    count(*) filter (where counts_ws)::bigint as ws_total,
    null::bigint as total_favorites
  from scored
  where category is not null
  group by category;
$$;
