# PLL audio restore — storage backfill runbook

## Root cause

- Playback reads `public.pairs.word_target_audio_url` and `public.pairs.sentence_target_audio_url`.
- `pair_templates` has **no** audio columns; URLs always lived on `pairs`.
- Supabase Storage bucket `tts` still contains the MP3 objects, but **`pairs` URL columns became all null** (metadata loss).
- The app resolves playable URLs from those columns (and supports `storage/v1/...` relative paths); with nulls, audio cannot work.

## Why files could exist but the app stayed silent

- The browser never fetches Storage directly from `pair_templates` or deck text alone.
- Without DB URLs, `hasAudio` is false and play handlers no-op / controls stay disabled.

## Deterministic URL rule (from repo TTS scripts)

From `tts_batch_auto_en_es.js` / `tts_batch_multi.js`:

- Object key: `{languageCode}/word/{pairs.id}.mp3` and `{languageCode}/sentence/{pairs.id}.mp3`
- `languageCode` comes from deck target language (e.g. Spanish → `es-ES`, English → `en-GB` in the auto EN/ES script).
- **`pairs.id`** is the row UUID used in the filename (not `pair_template_id`).

Legacy `tts_batch.js` used an extra text slug in the filename; this backfill targets the **id-only** layout (matches your `es-ES/word/<uuid>.mp3` examples). If some rows only exist under slug keys, regenerate those separately (out of scope for this SQL-only backfill).

## What to run (Supabase)

1. Open **SQL Editor** (role: `postgres` or sufficient privileges on `public.pairs` / `public.decks`).
2. Paste and execute:

   `sql/backfill_pair_audio_urls_from_storage.sql`

3. If your bucket uses **`pair_template_id`** in filenames instead of `pairs.id`, follow the OPTIONAL comment at the bottom of that file and run the adjusted `UPDATE` once.

4. If you add decks whose `target_lang` is not covered by the `CASE` mapping, extend the mapping in the SQL file first, then re-run.

## Verify

```sql
select
  count(*)::bigint as total_pairs,
  count(*) filter (where word_target_audio_url is not null)::bigint as with_word_audio,
  count(*) filter (where sentence_target_audio_url is not null)::bigint as with_sentence_audio
from public.pairs;
```

Spot-check one row and open the resolved URL in a browser (prepend your project URL if you paste the `storage/v1/...` form):

- `https://<project-ref>.supabase.co` + `/` + `storage/v1/object/public/tts/es-ES/word/<pair-id>.mp3`

## Provisioning after backfill

- `sync_default_content_for_user` / `sync_selected_content_for_user` copy audio from existing `pairs` rows with the same `pair_template_id`.
- After this backfill, that propagation works again **as long as** the copied URLs remain valid for all rows that share them (true when URLs are template-agnostic or identical per template; if you rely solely on per-row `pairs.id` keys, new users may still need a TTS pass for brand-new UUIDs).

## App expectations

- `app/decks/[id]/practice/lib/resolvePracticeAudioUrl.ts` accepts `https://...`, `storage/v1/...`, or `tts/...` keys.
