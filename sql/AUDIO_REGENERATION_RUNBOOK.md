# PLL audio restore — regeneration (canonical per template)

> Emergency repair runbook.
>
> Current runtime inherited audio is resolved from canonical template metadata.
> This document remains relevant for storage/object repair and for repopulating
> compatibility metadata on `public.pairs`, not as a description of normal
> runtime ownership.

## Historical root cause

- Earlier runtime/app paths played audio directly from
  `public.pairs.word_target_audio_url` and `public.pairs.sentence_target_audio_url`.
- Storage bucket `tts` can still contain many MP3s while playback fails if **those objects were produced for a different ID universe** (older DB, different project, or keys that never matched the current `pairs.id` / `pair_template_id` values).
- In that situation, **SQL backfill that guesses paths from current row IDs** will not find real objects. See `sql/AUDIO_BACKFILL_RUNBOOK.md` only when keys truly match the live schema.

## Why backfill from “current” IDs failed

- Legacy scripts wrote `{locale}/word/{pairs.id}.mp3` (and sentence). If the live DB was re-seeded or migrated, **current** `pairs.id` values do not correspond to the filenames that exist in the bucket.
- Copying URLs from guessed paths then points the browser at **404 or wrong audio**.

## Regeneration strategy

- **One canonical file per `pair_templates.id` + kind (word / sentence)**, under bucket `tts`, using keys that **do not collide** with legacy `pairs.id` filenames:
  - `{languageCode}/word/pt-{pair_template_id}.mp3`
  - `{languageCode}/sentence/pt-{pair_template_id}.mp3`
- `languageCode` is derived from `deck_templates.target_lang` for that template (same mapping as in `tts_regenerate_canonical.js`).
- After Google TTS + upload, the script runs **`UPDATE public.pairs SET ... WHERE pair_template_id = ...`** so every user row for that template gets the same compatibility URL value.
- **Skip logic (default):** for each template, generate word/sentence only if **at least one** `pairs` row for that template still has a **null** URL for that column (unless `--force true`). Templates with **no** `pairs` rows are skipped (nothing to update).
- **Provisioning note:** current provisioning does not inherit audio into new
  `pairs` rows. The `public.pairs` updates performed by this script are retained
  for compatibility/repair workflows; canonical runtime reads still come from
  `template_audio_assets`.

## Prerequisites (local)

1. **Node** (repo already has `@google-cloud/text-to-speech`, `@supabase/supabase-js`, `dotenv`).
2. **`.env.local`** at repo root with:
   - `SUPABASE_URL` — project URL (e.g. `https://<ref>.supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY` — **service role** (Storage upload + broad `pairs` update). Never commit this file.
   - `GOOGLE_APPLICATION_CREDENTIALS` — absolute path to a Google Cloud **service account JSON** with **Cloud Text-to-Speech API** enabled for the project that owns the key.

3. Supabase Storage: bucket **`tts`** is public (or URLs you write must match how the app resolves them). The script uses `upsert: true` on upload.

## How to run regeneration

From the repo root:

```bash
npm run tts:regenerate-canonical -- --sleep 600
```

The script **fetches `pair_templates` in DB pages** (`.range`, default 1000 rows per request) until a page returns fewer rows than the page size, so a single command walks the **full** table (tens of thousands of rows). You do not need to manually chain offsets against Supabase.

Useful flags (see header in `tts_regenerate_canonical.js`):

| Flag | Meaning |
|------|--------|
| `--max 20` | Process only the first 20 templates in the **filtered** stream (after `--offset`). |
| `--offset 0 --limit 500` | Skip the first `--offset` filtered templates; then process at most `--limit` templates (`--limit` wins over `--max` if both are set). |
| `--pageSize 1000` | Rows per Supabase fetch (capped at 1000). |
| `--sleep 600` | Ms between TTS calls (rate limiting / quota). |
| `--force true` | Re-upload and overwrite DB URLs even when no nulls remain. |

Example smoke test:

```bash
npm run tts:regenerate-canonical -- --max 1 --sleep 1000
```

## Optional manual SQL (Supabase)

- **Clear bad URLs** so the default skip logic regenerates everything (without `--force`): run `sql/clear_pair_audio_urls.sql` and edit the `WHERE` clause for your scope (whole table vs specific decks only).
- **After bulk regen** if you use the materialized view path:  
  `REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_pair_template_audio;`  
  (or non-concurrent if index setup differs — see `sync_default_content_performance.sql`.)

## Verify

1. **Counts:**

```sql
select
  count(*)::bigint as total_pairs,
  count(*) filter (where word_target_audio_url is not null)::bigint as with_word_audio,
  count(*) filter (where sentence_target_audio_url is not null)::bigint as with_sentence_audio
from public.pairs;
```

2. **Spot-check URLs:** pick a `pair_template_id`, confirm `pairs` rows share the same compatibility URL value, and open it in a browser (full `https://...` from `getPublicUrl`).

3. **App:** open practice for an existing deck — word and sentence playback. Create or sync a **new** user / deck and confirm audio still works (provisioning inheritance).

## Relation to older scripts

- `tts_batch.js`, `tts_batch_multi.js`, `tts_batch_auto_en_es.js` historically used **`pairs.id`** in filenames. This regeneration path intentionally uses **`pt-` + `pair_template_id`** so new objects do not overwrite or depend on legacy key layout.
