-- =============================================================================
-- Backfill public.pairs audio URL columns from existing Supabase Storage layout
-- =============================================================================
-- Historical TTS batch scripts (see repo root: tts_batch_auto_en_es.js,
-- tts_batch_multi.js, tts_batch.js) upload objects under bucket `tts` and
-- store either:
--   - full public https URLs, or
--   - paths compatible with the app resolver (see resolvePracticeAudioUrl.ts)
--
-- Canonical layout used by tts_batch_auto_en_es.js / tts_batch_multi.js:
--   {languageCode}/word/{pairs.id}.mp3
--   {languageCode}/sentence/{pairs.id}.mp3
-- where `languageCode` is the Google TTS locale string (e.g. es-ES, en-GB),
-- and `pairs.id` is the UUID of the **public.pairs row** (NOT pair_template_id).
--
-- This script writes **relative** URLs so the app can prepend the project host:
--   storage/v1/object/public/tts/{locale}/word/{pair_id}.mp3
--   storage/v1/object/public/tts/{locale}/sentence/{pair_id}.mp3
--
-- Apply in Supabase SQL Editor as a privileged role (postgres).
-- Review locale mapping below if your decks.target_lang values differ.
-- =============================================================================

begin;

with deck_locale as (
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
    end as storage_locale
  from public.decks d
)
update public.pairs p
set
  word_target_audio_url = coalesce(
    p.word_target_audio_url,
    case
      when dl.storage_locale is not null
        and p.word_target is not null
        and btrim(p.word_target) <> ''
      then 'storage/v1/object/public/tts/'
        || dl.storage_locale
        || '/word/'
        || p.id::text
        || '.mp3'
    end
  ),
  sentence_target_audio_url = coalesce(
    p.sentence_target_audio_url,
    case
      when dl.storage_locale is not null
        and p.sentence_target is not null
        and btrim(p.sentence_target) <> ''
      then 'storage/v1/object/public/tts/'
        || dl.storage_locale
        || '/sentence/'
        || p.id::text
        || '.mp3'
    end
  )
from deck_locale dl
where p.deck_id = dl.deck_id
  and dl.storage_locale is not null
  and (
    p.word_target_audio_url is null
    or p.sentence_target_audio_url is null
  );

commit;

-- -----------------------------------------------------------------------------
-- OPTIONAL: alternate filename = pair_template_id (only if your bucket uses it)
-- -----------------------------------------------------------------------------
-- If objects are named es-ES/word/<pair_template_id>.mp3 instead of pairs.id,
-- duplicate this UPDATE replacing p.id::text with p.pair_template_id::text
-- in BOTH path segments, then re-run verification queries from the runbook.
