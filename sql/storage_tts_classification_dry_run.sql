-- =============================================================================
-- TTS storage classification dry-run (non-destructive)
-- =============================================================================
-- Purpose:
-- 1) Classify `storage.objects` files in bucket `tts` by naming style and refs.
-- 2) Quantify referenced vs unreferenced storage by locale/kind/style.
-- 3) Identify canonical normalization candidates (legacy key -> pt key).
-- 4) Estimate canonical-coverage expansion potential from existing pt objects.
--
-- This script performs READS only. No updates/deletes.
-- =============================================================================

with objects_raw as (
  select
    o.name,
    split_part(o.name, '/', 1) as locale,
    split_part(o.name, '/', 2) as kind,
    split_part(o.name, '/', 3) as filename,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes
  from storage.objects o
  where o.bucket_id = 'tts'
),
objects_classified as (
  select
    r.*,
    (r.filename like 'pt-%.mp3' and char_length(r.filename) = 43) as is_pt,
    (r.filename like '%.mp3' and r.filename not like 'pt-%.mp3' and char_length(r.filename) = 40) as is_legacy,
    case
      when (r.filename like 'pt-%.mp3' and char_length(r.filename) = 43) then substring(r.filename from 4 for 36)
      when (r.filename like '%.mp3' and r.filename not like 'pt-%.mp3' and char_length(r.filename) = 40) then substring(r.filename from 1 for 36)
      else null
    end as uuid_key
  from objects_raw r
),
canonical_ref_keys as (
  select distinct btrim(key_norm) as key_norm
  from (
    select taa.word_audio_key as key_norm
    from public.template_audio_assets taa
    where taa.word_audio_key is not null

    union all

    select taa.sentence_audio_key as key_norm
    from public.template_audio_assets taa
    where taa.sentence_audio_key is not null
  ) k
  where key_norm is not null
    and btrim(key_norm) <> ''
),
pairs_ref_keys as (
  select distinct key_norm
  from (
    select case
      when p.word_target_audio_url is null then null
      when p.word_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.word_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.word_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.word_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.word_target_audio_url like '%/object/public/tts/%' then split_part(p.word_target_audio_url, '/object/public/tts/', 2)
      when p.word_target_audio_url like '%tts/%' then split_part(p.word_target_audio_url, 'tts/', 2)
      else btrim(p.word_target_audio_url)
    end as key_norm
    from public.pairs p

    union all

    select case
      when p.sentence_target_audio_url is null then null
      when p.sentence_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.sentence_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.sentence_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.sentence_target_audio_url like '%/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/object/public/tts/', 2)
      when p.sentence_target_audio_url like '%tts/%' then split_part(p.sentence_target_audio_url, 'tts/', 2)
      else btrim(p.sentence_target_audio_url)
    end as key_norm
    from public.pairs p
  ) q
  where key_norm is not null
    and key_norm <> ''
),
objects_enriched as (
  select
    oc.*,
    case
      when oc.is_pt then 'pt'
      when oc.is_legacy then 'legacy'
      else 'other'
    end as style,
    (ck.key_norm is not null) as is_canonical_ref,
    (pk.key_norm is not null) as is_pairs_ref,
    (ck.key_norm is not null or pk.key_norm is not null) as is_any_db_ref,
    (oc.locale || '/' || oc.kind || '/pt-' || oc.uuid_key || '.mp3') as pt_equivalent_name
  from objects_classified oc
  left join canonical_ref_keys ck on ck.key_norm = oc.name
  left join pairs_ref_keys pk on pk.key_norm = oc.name
),
pt_names as (
  select distinct name
  from objects_enriched
  where style = 'pt'
)

-- -----------------------------------------------------------------------------
-- A) Topline classification
-- -----------------------------------------------------------------------------
select
  count(*)::bigint as total_tts_files,
  round(sum(size_bytes)::numeric / 1024 / 1024, 2) as total_mb,

  count(*) filter (where style = 'pt' and is_canonical_ref)::bigint as canon_ref_pt_files,
  round(coalesce(sum(size_bytes) filter (where style = 'pt' and is_canonical_ref), 0)::numeric / 1024 / 1024, 2) as canon_ref_pt_mb,

  count(*) filter (where style = 'legacy' and is_canonical_ref)::bigint as canon_ref_legacy_files,
  round(coalesce(sum(size_bytes) filter (where style = 'legacy' and is_canonical_ref), 0)::numeric / 1024 / 1024, 2) as canon_ref_legacy_mb,

  count(*) filter (where style = 'pt' and not is_canonical_ref)::bigint as pt_not_in_template_audio_assets_files,
  round(coalesce(sum(size_bytes) filter (where style = 'pt' and not is_canonical_ref), 0)::numeric / 1024 / 1024, 2) as pt_not_in_template_audio_assets_mb,

  count(*) filter (where style = 'legacy' and exists (select 1 from pt_names pn where pn.name = objects_enriched.pt_equivalent_name))::bigint as legacy_with_pt_equivalent_files,
  round(coalesce(sum(size_bytes) filter (where style = 'legacy' and exists (select 1 from pt_names pn where pn.name = objects_enriched.pt_equivalent_name)), 0)::numeric / 1024 / 1024, 2) as legacy_with_pt_equivalent_mb,

  count(*) filter (where not is_any_db_ref)::bigint as unreferenced_orphan_files,
  round(coalesce(sum(size_bytes) filter (where not is_any_db_ref), 0)::numeric / 1024 / 1024, 2) as unreferenced_orphan_mb
from objects_enriched;

-- -----------------------------------------------------------------------------
-- B) Breakdown by locale / kind / style / reference status
-- -----------------------------------------------------------------------------
with objects_raw as (
  select
    o.name,
    split_part(o.name, '/', 1) as locale,
    split_part(o.name, '/', 2) as kind,
    split_part(o.name, '/', 3) as filename,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes
  from storage.objects o
  where o.bucket_id = 'tts'
),
objects_classified as (
  select
    r.*,
    case
      when r.filename like 'pt-%.mp3' and char_length(r.filename) = 43 then 'pt'
      when r.filename like '%.mp3' and r.filename not like 'pt-%.mp3' and char_length(r.filename) = 40 then 'legacy'
      else 'other'
    end as style
  from objects_raw r
),
canonical_ref_keys as (
  select distinct btrim(word_audio_key) as key_norm
  from public.template_audio_assets
  where word_audio_key is not null
  union
  select distinct btrim(sentence_audio_key) as key_norm
  from public.template_audio_assets
  where sentence_audio_key is not null
),
pairs_ref_keys as (
  select distinct key_norm
  from (
    select case
      when p.word_target_audio_url is null then null
      when p.word_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.word_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.word_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.word_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.word_target_audio_url like '%/object/public/tts/%' then split_part(p.word_target_audio_url, '/object/public/tts/', 2)
      when p.word_target_audio_url like '%tts/%' then split_part(p.word_target_audio_url, 'tts/', 2)
      else btrim(p.word_target_audio_url)
    end as key_norm
    from public.pairs p
    union all
    select case
      when p.sentence_target_audio_url is null then null
      when p.sentence_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/storage/v1/object/public/tts/', 2)
      when p.sentence_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.sentence_target_audio_url, 'storage/v1/object/public/tts/', '')
      when p.sentence_target_audio_url like '%/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/object/public/tts/', 2)
      when p.sentence_target_audio_url like '%tts/%' then split_part(p.sentence_target_audio_url, 'tts/', 2)
      else btrim(p.sentence_target_audio_url)
    end as key_norm
    from public.pairs p
  ) refs
  where key_norm is not null and key_norm <> ''
)
select
  oc.locale,
  oc.kind,
  oc.style,
  case
    when ck.key_norm is not null then 'canonical_ref'
    when pk.key_norm is not null then 'pairs_ref_only'
    else 'unreferenced'
  end as ref_status,
  count(*)::bigint as files,
  round(sum(oc.size_bytes)::numeric / 1024 / 1024, 2) as mb
from objects_classified oc
left join canonical_ref_keys ck on ck.key_norm = oc.name
left join pairs_ref_keys pk on pk.key_norm = oc.name
group by oc.locale, oc.kind, oc.style, ref_status
order by oc.locale, oc.kind, oc.style, ref_status;

-- -----------------------------------------------------------------------------
-- C) Canonical normalization check (legacy key currently canonical but pt exists)
-- -----------------------------------------------------------------------------
with tts_pt_names as (
  select distinct name
  from storage.objects
  where bucket_id = 'tts'
    and split_part(name, '/', 3) like 'pt-%.mp3'
    and char_length(split_part(name, '/', 3)) = 43
),
legacy_canonical as (
  select
    taa.pair_template_id,
    taa.word_audio_key,
    taa.sentence_audio_key,
    split_part(taa.word_audio_key, '/', 1) as word_locale,
    split_part(taa.sentence_audio_key, '/', 1) as sentence_locale,
    (split_part(taa.word_audio_key, '/', 3) like '%.mp3'
      and split_part(taa.word_audio_key, '/', 3) not like 'pt-%.mp3'
      and char_length(split_part(taa.word_audio_key, '/', 3)) = 40) as word_is_legacy,
    (split_part(taa.sentence_audio_key, '/', 3) like '%.mp3'
      and split_part(taa.sentence_audio_key, '/', 3) not like 'pt-%.mp3'
      and char_length(split_part(taa.sentence_audio_key, '/', 3)) = 40) as sentence_is_legacy
  from public.template_audio_assets taa
),
candidates as (
  select
    lc.*,
    (lc.word_locale || '/word/pt-' || lc.pair_template_id::text || '.mp3') as expected_pt_word,
    (lc.sentence_locale || '/sentence/pt-' || lc.pair_template_id::text || '.mp3') as expected_pt_sentence
  from legacy_canonical lc
)
select
  count(*) filter (where word_is_legacy)::bigint as canonical_word_legacy_rows,
  count(*) filter (where sentence_is_legacy)::bigint as canonical_sentence_legacy_rows,
  count(*) filter (
    where word_is_legacy
      and exists (select 1 from tts_pt_names t where t.name = candidates.expected_pt_word)
  )::bigint as word_legacy_rows_with_pt_equivalent,
  count(*) filter (
    where sentence_is_legacy
      and exists (select 1 from tts_pt_names t where t.name = candidates.expected_pt_sentence)
  )::bigint as sentence_legacy_rows_with_pt_equivalent
from candidates;

-- -----------------------------------------------------------------------------
-- D) Canonical-coverage expansion potential (missing rows but pt objects exist)
-- -----------------------------------------------------------------------------
with dt_locale as (
  select
    dt.id as deck_template_id,
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
    end as locale
  from public.deck_templates dt
),
pt_objects as (
  select
    split_part(o.name, '/', 1) as locale,
    substring(split_part(o.name, '/', 3) from 4 for 36) as pair_template_id,
    bool_or(split_part(o.name, '/', 2) = 'word') as has_pt_word,
    bool_or(split_part(o.name, '/', 2) = 'sentence') as has_pt_sentence
  from storage.objects o
  where o.bucket_id = 'tts'
    and split_part(o.name, '/', 3) like 'pt-%.mp3'
    and char_length(split_part(o.name, '/', 3)) = 43
  group by split_part(o.name, '/', 1), substring(split_part(o.name, '/', 3) from 4 for 36)
),
missing_taa as (
  select
    pt.id as pair_template_id,
    dl.locale,
    (pt.sentence_target is not null and btrim(pt.sentence_target) <> '') as has_sentence_text
  from public.pair_templates pt
  join dt_locale dl on dl.deck_template_id = pt.deck_template_id
  left join public.template_audio_assets taa on taa.pair_template_id = pt.id
  where taa.pair_template_id is null
),
coverage as (
  select
    m.pair_template_id,
    m.has_sentence_text,
    coalesce(po.has_pt_word, false) as has_pt_word_object,
    coalesce(po.has_pt_sentence, false) as has_pt_sentence_object
  from missing_taa m
  left join pt_objects po
    on po.pair_template_id = m.pair_template_id::text
   and po.locale = m.locale
)
select
  count(*)::bigint as templates_missing_from_taa,
  count(*) filter (where has_pt_word_object)::bigint as missing_templates_with_pt_word,
  count(*) filter (where has_sentence_text and has_pt_sentence_object)::bigint as missing_templates_with_pt_sentence,
  count(*) filter (where has_pt_word_object or (has_sentence_text and has_pt_sentence_object))::bigint as missing_templates_expandable_now,
  count(*) filter (where has_pt_word_object and (not has_sentence_text or has_pt_sentence_object))::bigint as missing_templates_fully_expandable_now
from coverage;
