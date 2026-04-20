-- Safe, non-destructive backfill for public.template_audio_assets.
-- Source priority (per kind):
--   1) existing template_audio_assets key (kept as-is)
--   2) parsed key from existing public.pairs audio URLs (only when no conflicts)
--   3) synthesized canonical pt path key from locale + pair_template_id
--
-- Notes:
-- - No deletes.
-- - No nulling existing keys.
-- - Upsert only fills missing values or preserves current values.

with locale_map as (
  select
    d.id as deck_id,
    case
      when lower(btrim(coalesce(d.target_lang, ''))) like 'es%' then 'es-ES'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'en%' then 'en-GB'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'pl%' then 'pl-PL'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'de%' then 'de-DE'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'fr%' then 'fr-FR'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'it%' then 'it-IT'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'pt%' then 'pt-PT'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'ru%' then 'ru-RU'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'tr%' then 'tr-TR'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'ar%' then 'ar-SA'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'sw%' then 'sw-KE'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'zh%' then 'zh-CN'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'ja%' then 'ja-JP'
      when lower(btrim(coalesce(d.target_lang, ''))) like 'ko%' then 'ko-KR'
      else null
    end as mapped_locale
  from public.decks d
),
pair_audio_normalized as (
  select
    p.pair_template_id,
    lm.mapped_locale,
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
    end as parsed_word_key,
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
    end as parsed_sentence_key
  from public.pairs p
  left join locale_map lm on lm.deck_id = p.deck_id
  where p.pair_template_id is not null
),
pair_audio_grouped as (
  select
    pan.pair_template_id,
    max(pan.parsed_word_key) as parsed_word_key,
    max(pan.parsed_sentence_key) as parsed_sentence_key,
    count(distinct pan.parsed_word_key) filter (where pan.parsed_word_key is not null) as distinct_word_keys,
    count(distinct pan.parsed_sentence_key) filter (where pan.parsed_sentence_key is not null) as distinct_sentence_keys,
    max(pan.mapped_locale) as mapped_locale
  from pair_audio_normalized pan
  group by pan.pair_template_id
),
resolved_candidates as (
  select
    pt.id as pair_template_id,
    taa.word_audio_key as existing_word_key,
    taa.sentence_audio_key as existing_sentence_key,
    case
      when pag.distinct_word_keys <= 1 then pag.parsed_word_key
      else null
    end as parsed_word_key,
    case
      when pag.distinct_sentence_keys <= 1 then pag.parsed_sentence_key
      else null
    end as parsed_sentence_key,
    case
      when pag.mapped_locale is not null
      then pag.mapped_locale || '/word/pt-' || pt.id::text || '.mp3'
      else null
    end as synthesized_word_key,
    case
      when pag.mapped_locale is not null
       and pt.sentence_target is not null
       and btrim(pt.sentence_target) <> ''
      then pag.mapped_locale || '/sentence/pt-' || pt.id::text || '.mp3'
      else null
    end as synthesized_sentence_key
  from public.pair_templates pt
  left join pair_audio_grouped pag on pag.pair_template_id = pt.id
  left join public.template_audio_assets taa on taa.pair_template_id = pt.id
),
final_keys as (
  select
    rc.pair_template_id,
    coalesce(rc.existing_word_key, rc.parsed_word_key, rc.synthesized_word_key) as word_audio_key,
    coalesce(rc.existing_sentence_key, rc.parsed_sentence_key, rc.synthesized_sentence_key) as sentence_audio_key
  from resolved_candidates rc
)
insert into public.template_audio_assets (pair_template_id, word_audio_key, sentence_audio_key)
select
  fk.pair_template_id,
  fk.word_audio_key,
  fk.sentence_audio_key
from final_keys fk
where fk.word_audio_key is not null
   or fk.sentence_audio_key is not null
on conflict (pair_template_id) do update
set
  word_audio_key = coalesce(public.template_audio_assets.word_audio_key, excluded.word_audio_key),
  sentence_audio_key = coalesce(public.template_audio_assets.sentence_audio_key, excluded.sentence_audio_key),
  updated_at = now();

-- Optional verification after running:
-- select
--   count(*)::bigint as rows_total,
--   count(*) filter (where word_audio_key is not null)::bigint as rows_with_word_key,
--   count(*) filter (where sentence_audio_key is not null)::bigint as rows_with_sentence_key
-- from public.template_audio_assets;
