-- Backfill missing canonical template audio rows from existing pt-* storage objects only.
-- Safe and idempotent:
--   - inserts only when public.template_audio_assets has no row yet
--   - never overwrites existing canonical rows
--   - never infers from pairs.*, aggregates, or legacy URLs
--   - only writes keys that already exist in storage.objects

with template_scope as (
  select
    pt.id as pair_template_id,
    case
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'es%' then 'es-ES'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'en%' then 'en-GB'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'pl%' then 'pl-PL'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'de%' then 'de-DE'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'fr%' then 'fr-FR'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'it%' then 'it-IT'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'pt%' then 'pt-PT'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'ru%' then 'ru-RU'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'tr%' then 'tr-TR'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'ar%' then 'ar-SA'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'sw%' then 'sw-KE'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'zh%' then 'zh-CN'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'ja%' then 'ja-JP'
      when lower(btrim(coalesce(dt.target_lang, ''))) like 'ko%' then 'ko-KR'
      else null
    end as mapped_locale,
    nullif(btrim(coalesce(pt.sentence_target, '')), '') is not null as has_sentence_text
  from public.pair_templates pt
  join public.deck_templates dt on dt.id = pt.deck_template_id
),
missing_templates as (
  select
    ts.pair_template_id,
    ts.mapped_locale,
    ts.has_sentence_text
  from template_scope ts
  left join public.template_audio_assets taa
    on taa.pair_template_id = ts.pair_template_id
  where taa.pair_template_id is null
    and ts.mapped_locale is not null
),
existing_pt_objects as (
  select
    mt.pair_template_id,
    case
      when so_word.name is not null
      then mt.mapped_locale || '/word/pt-' || mt.pair_template_id::text || '.mp3'
      else null
    end as word_audio_key,
    case
      when mt.has_sentence_text and so_sentence.name is not null
      then mt.mapped_locale || '/sentence/pt-' || mt.pair_template_id::text || '.mp3'
      else null
    end as sentence_audio_key
  from missing_templates mt
  left join storage.objects so_word
    on so_word.bucket_id = 'tts'
   and so_word.name = mt.mapped_locale || '/word/pt-' || mt.pair_template_id::text || '.mp3'
  left join storage.objects so_sentence
    on so_sentence.bucket_id = 'tts'
   and so_sentence.name = mt.mapped_locale || '/sentence/pt-' || mt.pair_template_id::text || '.mp3'
)
insert into public.template_audio_assets (
  pair_template_id,
  word_audio_key,
  sentence_audio_key
)
select
  epo.pair_template_id,
  epo.word_audio_key,
  epo.sentence_audio_key
from existing_pt_objects epo
where epo.word_audio_key is not null
   or epo.sentence_audio_key is not null
on conflict (pair_template_id) do nothing;
