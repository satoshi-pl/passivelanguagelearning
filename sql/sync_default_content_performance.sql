-- =============================================================================
-- sync_default_content / sync_default_content_for_user — performance fix
-- =============================================================================
-- Root cause (typical):
--   The "audio_src" inline subquery aggregates ALL rows in public.pairs:
--     select pair_template_id, max(...), max(...)
--     from public.pairs where ... group by pair_template_id
--   That is O(N) over the whole table on EVERY new-user provisioning call,
--   plus a large INSERT into pairs. Together this often exceeds
--   statement_timeout (PostgreSQL 57014).
--
-- Canonical-first provisioning:
--   1) public.template_audio_assets keys (preferred)
--   2) mv_pair_template_audio (legacy fallback aggregate)
-- The MV remains useful as compatibility fallback during migration.
--
-- Apply in Supabase SQL Editor as a privileged role (postgres / dashboard).
-- After deploy: REFRESH MATERIALIZED VIEW when bulk audio backfills change sources.
--
-- If public.pairs audio URL columns are null or wrong but Storage keys do not match live row IDs,
-- run sql/AUDIO_REGENERATION_RUNBOOK.md (tts_regenerate_canonical.js). If keys match pairs.id layout,
-- sql/backfill_pair_audio_urls_from_storage.sql (sql/AUDIO_BACKFILL_RUNBOOK.md) may suffice.
-- =============================================================================

-- 1) Lookup: one row per pair_template_id with best-known audio URLs
-- First run only: creates MV + index. If MV already exists, skip to section 1b (REFRESH).
DO $mv$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname = 'mv_pair_template_audio'
  ) THEN
    EXECUTE $sql$
      CREATE MATERIALIZED VIEW public.mv_pair_template_audio AS
      SELECT
        pair_template_id,
        max(word_target_audio_url) AS word_target_audio_url,
        max(sentence_target_audio_url) AS sentence_target_audio_url
      FROM public.pairs
      WHERE word_target_audio_url IS NOT NULL
         OR sentence_target_audio_url IS NOT NULL
      GROUP BY pair_template_id
    $sql$;

    EXECUTE $sql$
      CREATE UNIQUE INDEX mv_pair_template_audio_pkey
        ON public.mv_pair_template_audio (pair_template_id)
    $sql$;
  END IF;
END
$mv$;

COMMENT ON MATERIALIZED VIEW public.mv_pair_template_audio IS
  'Pre-aggregated audio URLs per pair_template_id for sync_default_content_for_user; REFRESH after bulk audio updates.';

-- 1b) After large audio backfills, re-run this (CONCURRENTLY needs unique index above):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_pair_template_audio;
REFRESH MATERIALIZED VIEW public.mv_pair_template_audio;

-- 2) Replace per-user sync to prefer template_audio_assets, then fallback to MV
CREATE OR REPLACE FUNCTION public.sync_default_content_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.decks (
    user_id,
    deck_template_id,
    name,
    target_lang,
    native_lang,
    level
  )
  SELECT
    p_user_id,
    dt.id,
    dt.name,
    dt.target_lang,
    dt.native_lang,
    dt.level
  FROM public.deck_templates dt
  LEFT JOIN public.decks d
    ON d.user_id = p_user_id
   AND d.deck_template_id = dt.id
  WHERE d.id IS NULL;

  INSERT INTO public.pairs (
    deck_id,
    pair_template_id,
    word_target,
    word_native,
    sentence_target,
    sentence_native,
    word_target_audio_url,
    sentence_target_audio_url,
    category
  )
  SELECT
    d.id AS deck_id,
    pt.id AS pair_template_id,
    pt.word_target,
    pt.word_native,
    pt.sentence_target,
    pt.sentence_native,
    coalesce(taa.word_audio_key, audio_src.word_target_audio_url),
    coalesce(taa.sentence_audio_key, audio_src.sentence_target_audio_url),
    pt.category
  FROM public.pair_templates pt
  JOIN public.decks d
    ON d.user_id = p_user_id
   AND d.deck_template_id = pt.deck_template_id
  LEFT JOIN public.pairs p
    ON p.deck_id = d.id
   AND p.pair_template_id = pt.id
  LEFT JOIN public.template_audio_assets taa
    ON taa.pair_template_id = pt.id
  LEFT JOIN public.mv_pair_template_audio audio_src
    ON audio_src.pair_template_id = pt.id
  WHERE p.id IS NULL;
END;
$function$;

-- 3) If your wrapper only delegates to auth.uid(), keep or recreate as needed:
-- CREATE OR REPLACE FUNCTION public.sync_default_content()
-- RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
--   SELECT public.sync_default_content_for_user(auth.uid());
-- $$;

-- =============================================================================
-- EMERGENCY fallback (no audio inheritance; pairs get NULL audio URLs):
-- Uncomment ONLY if you cannot use the MV yet — restores fast provisioning.
-- =============================================================================
-- CREATE OR REPLACE FUNCTION public.sync_default_content_for_user(p_user_id uuid)
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
-- BEGIN
--   INSERT INTO public.decks (...)
--   SELECT ... same as above ...;
--   INSERT INTO public.pairs (..., word_target_audio_url, sentence_target_audio_url, ...)
--   SELECT ..., NULL::text, NULL::text, pt.category
--   FROM public.pair_templates pt
--   JOIN public.decks d ON ...
--   LEFT JOIN public.pairs p ON ...
--   WHERE p.id IS NULL;
-- END;
-- $f$;
