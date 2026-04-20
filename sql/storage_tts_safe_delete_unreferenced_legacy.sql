-- =============================================================================
-- SAFE DELETE WORKFLOW (staged): unreferenced legacy UUID-style TTS files
-- =============================================================================
-- WARNING:
-- - This script is for controlled cleanup after reviewing dry-run outputs.
-- - It targets only legacy UUID-style files (`{uuid}.mp3`) that are unreferenced
--   by both:
--     1) public.template_audio_assets
--     2) public.pairs.*_audio_url
-- - Keep fallback code and DB columns in place until after cleanup validation.
--
-- Recommended usage:
-- 1) Run Section A (dry-run summary).
-- 2) Run Section B (sample candidate list).
-- 3) When approved, run Section C in a transaction and verify row count.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Dry-run summary (no deletion)
-- -----------------------------------------------------------------------------
with canonical_ref_keys as (
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
  where key_norm is not null
    and key_norm <> ''
),
deletion_candidates as (
  select
    o.id,
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes
  from storage.objects o
  left join canonical_ref_keys ck on ck.key_norm = o.name
  left join pairs_ref_keys pk on pk.key_norm = o.name
  where o.bucket_id = 'tts'
    and split_part(o.name, '/', 3) like '%.mp3'
    and split_part(o.name, '/', 3) not like 'pt-%.mp3'
    and char_length(split_part(o.name, '/', 3)) = 40
    and ck.key_norm is null
    and pk.key_norm is null
)
select
  count(*)::bigint as candidate_files,
  round(sum(size_bytes)::numeric / 1024 / 1024, 2) as candidate_mb
from deletion_candidates;

-- -----------------------------------------------------------------------------
-- B) Dry-run sample list (no deletion)
-- -----------------------------------------------------------------------------
with canonical_ref_keys as (
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
  where key_norm is not null
    and key_norm <> ''
)
select
  o.id,
  o.name,
  split_part(o.name, '/', 1) as locale,
  split_part(o.name, '/', 2) as kind,
  coalesce((o.metadata->>'size')::bigint, 0) as size_bytes
from storage.objects o
left join canonical_ref_keys ck on ck.key_norm = o.name
left join pairs_ref_keys pk on pk.key_norm = o.name
where o.bucket_id = 'tts'
  and split_part(o.name, '/', 3) like '%.mp3'
  and split_part(o.name, '/', 3) not like 'pt-%.mp3'
  and char_length(split_part(o.name, '/', 3)) = 40
  and ck.key_norm is null
  and pk.key_norm is null
order by o.name
limit 200;

-- -----------------------------------------------------------------------------
-- C) OPTIONAL delete block (run only after explicit approval)
-- -----------------------------------------------------------------------------
-- begin;
--
-- create temporary table _tts_delete_candidates as
-- with canonical_ref_keys as (
--   select distinct btrim(word_audio_key) as key_norm
--   from public.template_audio_assets
--   where word_audio_key is not null
--   union
--   select distinct btrim(sentence_audio_key) as key_norm
--   from public.template_audio_assets
--   where sentence_audio_key is not null
-- ),
-- pairs_ref_keys as (
--   select distinct key_norm
--   from (
--     select case
--       when p.word_target_audio_url is null then null
--       when p.word_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.word_target_audio_url, '/storage/v1/object/public/tts/', 2)
--       when p.word_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.word_target_audio_url, 'storage/v1/object/public/tts/', '')
--       when p.word_target_audio_url like '%/object/public/tts/%' then split_part(p.word_target_audio_url, '/object/public/tts/', 2)
--       when p.word_target_audio_url like '%tts/%' then split_part(p.word_target_audio_url, 'tts/', 2)
--       else btrim(p.word_target_audio_url)
--     end as key_norm
--     from public.pairs p
--     union all
--     select case
--       when p.sentence_target_audio_url is null then null
--       when p.sentence_target_audio_url like '%/storage/v1/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/storage/v1/object/public/tts/', 2)
--       when p.sentence_target_audio_url like 'storage/v1/object/public/tts/%' then replace(p.sentence_target_audio_url, 'storage/v1/object/public/tts/', '')
--       when p.sentence_target_audio_url like '%/object/public/tts/%' then split_part(p.sentence_target_audio_url, '/object/public/tts/', 2)
--       when p.sentence_target_audio_url like '%tts/%' then split_part(p.sentence_target_audio_url, 'tts/', 2)
--       else btrim(p.sentence_target_audio_url)
--     end as key_norm
--     from public.pairs p
--   ) refs
--   where key_norm is not null
--     and key_norm <> ''
-- )
-- select o.id
-- from storage.objects o
-- left join canonical_ref_keys ck on ck.key_norm = o.name
-- left join pairs_ref_keys pk on pk.key_norm = o.name
-- where o.bucket_id = 'tts'
--   and split_part(o.name, '/', 3) like '%.mp3'
--   and split_part(o.name, '/', 3) not like 'pt-%.mp3'
--   and char_length(split_part(o.name, '/', 3)) = 40
--   and ck.key_norm is null
--   and pk.key_norm is null;
--
-- delete from storage.objects so
-- using _tts_delete_candidates d
-- where so.id = d.id;
--
-- -- sanity check
-- select count(*) as remaining_candidates_after_delete
-- from storage.objects so
-- join _tts_delete_candidates d on d.id = so.id;
--
-- commit;
