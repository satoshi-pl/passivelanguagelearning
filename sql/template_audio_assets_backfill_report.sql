-- Read-only backfill/report helper for future template_audio_assets population.
-- This file intentionally avoids mutating live data.

-- 1) Candidate canonical keys per pair_template_id derived from existing pairs URLs.
with normalized as (
  select
    p.pair_template_id,
    -- Extract key after ".../object/public/tts/" or ".../tts/" if possible.
    case
      when p.word_target_audio_url is null then null
      when p.word_target_audio_url like '%/storage/v1/object/public/tts/%'
        then split_part(p.word_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.word_target_audio_url like 'storage/v1/object/public/tts/%'
        then replace(p.word_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.word_target_audio_url like '%/object/public/tts/%'
        then split_part(p.word_target_audio_url, '/object/public/tts/', 2)
      when p.word_target_audio_url like '%tts/%'
        then split_part(p.word_target_audio_url, 'tts/', 2)
      else null
    end as word_key,
    case
      when p.sentence_target_audio_url is null then null
      when p.sentence_target_audio_url like '%/storage/v1/object/public/tts/%'
        then split_part(p.sentence_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.sentence_target_audio_url like 'storage/v1/object/public/tts/%'
        then replace(p.sentence_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.sentence_target_audio_url like '%/object/public/tts/%'
        then split_part(p.sentence_target_audio_url, '/object/public/tts/', 2)
      when p.sentence_target_audio_url like '%tts/%'
        then split_part(p.sentence_target_audio_url, 'tts/', 2)
      else null
    end as sentence_key
  from public.pairs p
  where p.pair_template_id is not null
),
grouped as (
  select
    pair_template_id,
    max(word_key) as candidate_word_key,
    max(sentence_key) as candidate_sentence_key,
    count(distinct word_key) filter (where word_key is not null) as distinct_word_keys,
    count(distinct sentence_key) filter (where sentence_key is not null) as distinct_sentence_keys
  from normalized
  group by pair_template_id
)
select
  g.pair_template_id,
  g.candidate_word_key,
  g.candidate_sentence_key,
  g.distinct_word_keys,
  g.distinct_sentence_keys,
  case when g.distinct_word_keys > 1 or g.distinct_sentence_keys > 1 then 'conflict' else 'ok' end as quality_flag
from grouped g
order by g.pair_template_id
limit 200;

-- 2) Coverage summary for backfill readiness.
with normalized as (
  select
    p.pair_template_id,
    case
      when p.word_target_audio_url is null then null
      when p.word_target_audio_url like '%/storage/v1/object/public/tts/%'
        then split_part(p.word_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.word_target_audio_url like 'storage/v1/object/public/tts/%'
        then replace(p.word_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.word_target_audio_url like '%/object/public/tts/%'
        then split_part(p.word_target_audio_url, '/object/public/tts/', 2)
      when p.word_target_audio_url like '%tts/%'
        then split_part(p.word_target_audio_url, 'tts/', 2)
      else null
    end as word_key,
    case
      when p.sentence_target_audio_url is null then null
      when p.sentence_target_audio_url like '%/storage/v1/object/public/tts/%'
        then split_part(p.sentence_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.sentence_target_audio_url like 'storage/v1/object/public/tts/%'
        then replace(p.sentence_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.sentence_target_audio_url like '%/object/public/tts/%'
        then split_part(p.sentence_target_audio_url, '/object/public/tts/', 2)
      when p.sentence_target_audio_url like '%tts/%'
        then split_part(p.sentence_target_audio_url, 'tts/', 2)
      else null
    end as sentence_key
  from public.pairs p
  where p.pair_template_id is not null
),
grouped as (
  select
    pair_template_id,
    max(word_key) as candidate_word_key,
    max(sentence_key) as candidate_sentence_key,
    count(distinct word_key) filter (where word_key is not null) as distinct_word_keys,
    count(distinct sentence_key) filter (where sentence_key is not null) as distinct_sentence_keys
  from normalized
  group by pair_template_id
)
select
  count(*)::bigint as templates_with_pairs_rows,
  count(*) filter (where candidate_word_key is not null)::bigint as templates_with_word_key_candidate,
  count(*) filter (where candidate_sentence_key is not null)::bigint as templates_with_sentence_key_candidate,
  count(*) filter (where distinct_word_keys > 1 or distinct_sentence_keys > 1)::bigint as templates_with_key_conflicts
from grouped;

-- 3) Optional future backfill template (DO NOT run blindly in production):
-- insert into public.template_audio_assets (pair_template_id, word_audio_key, sentence_audio_key)
-- select pair_template_id, candidate_word_key, candidate_sentence_key
-- from grouped
-- where distinct_word_keys <= 1
--   and distinct_sentence_keys <= 1
-- on conflict (pair_template_id) do update
--   set word_audio_key = excluded.word_audio_key,
--       sentence_audio_key = excluded.sentence_audio_key,
--       updated_at = now();
