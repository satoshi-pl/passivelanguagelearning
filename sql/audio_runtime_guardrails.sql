-- Runtime guardrail snapshot for canonical-first audio resolution.
-- Read-only. Intended for repeated checks after releases/backfills.

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
pairs_enriched as (
  select
    p.id,
    case
      when taa.word_audio_key is not null then 'canonical'
      when p.word_target_audio_url is not null then 'pairs'
      when p.pair_template_id is not null and lm.mapped_locale is not null then 'pt_fallback'
      else 'missing'
    end as word_source,
    case
      when taa.sentence_audio_key is not null then 'canonical'
      when p.sentence_target_audio_url is not null then 'pairs'
      when p.pair_template_id is not null and lm.mapped_locale is not null then 'pt_fallback'
      else 'missing'
    end as sentence_source
  from public.pairs p
  left join public.template_audio_assets taa on taa.pair_template_id = p.pair_template_id
  left join locale_map lm on lm.deck_id = p.deck_id
),
agg as (
  select
    count(*)::bigint as total_pairs,
    count(*) filter (where word_source = 'canonical')::bigint as word_canonical,
    count(*) filter (where sentence_source = 'canonical')::bigint as sentence_canonical,
    count(*) filter (where word_source = 'pairs')::bigint as word_pairs,
    count(*) filter (where sentence_source = 'pairs')::bigint as sentence_pairs,
    count(*) filter (where word_source = 'pt_fallback')::bigint as word_pt_fallback,
    count(*) filter (where sentence_source = 'pt_fallback')::bigint as sentence_pt_fallback,
    count(*) filter (where word_source = 'missing')::bigint as word_missing,
    count(*) filter (where sentence_source = 'missing')::bigint as sentence_missing
  from pairs_enriched
)
select
  (select count(*)::bigint from public.template_audio_assets) as canonical_rows,
  a.*,
  round(100.0 * a.word_canonical / nullif(a.total_pairs, 0), 2) as pct_word_canonical,
  round(100.0 * a.sentence_canonical / nullif(a.total_pairs, 0), 2) as pct_sentence_canonical,
  (a.word_pairs = 0 and a.sentence_pairs = 0 and a.word_pt_fallback = 0 and a.sentence_pt_fallback = 0) as fallback_zero_ok,
  (a.word_missing = 0 and a.sentence_missing = 0) as missing_zero_ok
from agg a;
