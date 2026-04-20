-- Audio architecture validation snapshot query.
-- Read-only: can be run in Supabase SQL editor or psql.

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
    p.deck_id,
    p.pair_template_id,
    p.word_target_audio_url,
    p.sentence_target_audio_url,
    lm.mapped_locale,
    (p.word_target_audio_url is null and p.sentence_target_audio_url is null) as both_audio_null
  from public.pairs p
  left join locale_map lm on lm.deck_id = p.deck_id
),
template_rollup as (
  select
    pt.id as pair_template_id,
    count(p.id)::bigint as pair_rows,
    bool_or(p.word_target_audio_url is not null) as has_word_audio_in_pairs,
    bool_or(p.sentence_target_audio_url is not null) as has_sentence_audio_in_pairs
  from public.pair_templates pt
  left join public.pairs p on p.pair_template_id = pt.id
  group by pt.id
),
dup as (
  select
    pair_template_id,
    count(*)::bigint as pair_rows,
    count(distinct word_target_audio_url) filter (where word_target_audio_url is not null) as distinct_word_urls,
    count(distinct sentence_target_audio_url) filter (where sentence_target_audio_url is not null) as distinct_sentence_urls
  from public.pairs
  where pair_template_id is not null
  group by pair_template_id
),
dup_summary as (
  select
    count(*) filter (where pair_rows > 1)::bigint as templates_with_multiple_pairs_rows,
    count(*) filter (where distinct_word_urls > 1)::bigint as templates_with_conflicting_word_urls,
    count(*) filter (where distinct_sentence_urls > 1)::bigint as templates_with_conflicting_sentence_urls
  from dup
)
select
  (select count(*)::bigint from public.pair_templates) as total_pair_templates,
  (select count(*)::bigint from template_rollup where has_word_audio_in_pairs) as templates_with_word_audio,
  (select count(*)::bigint from template_rollup where has_sentence_audio_in_pairs) as templates_with_sentence_audio,
  (select count(*)::bigint from pairs_enriched where both_audio_null) as pairs_rows_with_null_audio,
  (select count(*)::bigint from pairs_enriched where both_audio_null and pair_template_id is not null and mapped_locale is not null)
    as rows_recoverable_only_through_fallback,
  (select count(*)::bigint from pairs_enriched where both_audio_null and (pair_template_id is null or mapped_locale is null))
    as rows_truly_missing_audio,
  ds.templates_with_multiple_pairs_rows,
  ds.templates_with_conflicting_word_urls,
  ds.templates_with_conflicting_sentence_urls,
  case
    when ds.templates_with_multiple_pairs_rows > 0
         and ds.templates_with_conflicting_word_urls = 0
         and ds.templates_with_conflicting_sentence_urls = 0
      then 'physical duplication (logical values currently consistent)'
    when ds.templates_with_conflicting_word_urls > 0
         or ds.templates_with_conflicting_sentence_urls > 0
      then 'logical duplication (conflicting values present)'
    else 'unknown or minimal duplication'
  end as duplication_assessment
from dup_summary ds;
