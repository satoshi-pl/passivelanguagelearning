# PLL Audio Architecture Audit

## Scope and constraints

- Pass type: audit + architecture-prep.
- Inputs used: repository code + live Supabase project `iwnjipugbmxraxmqhkpo` via MCP.
- No destructive operations were performed.
- No live data or schema was mutated.
- Existing fallback and playback behavior are documented as-is.

## Current sources of truth for audio

### Effective runtime source of truth today

1. **Primary runtime source**: `public.pairs.word_target_audio_url` and `public.pairs.sentence_target_audio_url`.
2. **Secondary/fallback runtime source**: derived path from `pair_template_id` in app server hydration:
   - `storage/v1/object/public/tts/{locale}/{kind}/pt-{pair_template_id}.mp3`
3. **Provisioning-time inheritance source**: existing `pairs` rows grouped by `pair_template_id` (direct aggregate or `mv_pair_template_audio`) are copied into new `pairs` rows.

### Important schema fact

- `public.pair_templates` currently has **no audio URL columns**.
- That means template-level canonical audio is not yet represented structurally in DB schema, even if code/scripts conceptually treat template IDs as canonical.

## Audio-related fields and where they live

## Live DB tables (confirmed)

- `public.pairs`
  - `pair_template_id uuid`
  - `word_target_audio_url text`
  - `sentence_target_audio_url text`
- `public.pair_templates`
  - no audio URL columns
- `public.pair_reports`
  - `audio_raw text` (captures reported playback reference)
- Session/state tables that indirectly depend on `pairs` audio payloads:
  - `public.user_pairs`
  - `public.user_favorites`
  - `public.user_pair_reviews`
  - `public.practice_sessions`

## Session hydration and RPC paths involved

### RPCs returning audio fields from `pairs`

- `get_session_pairs`
- `get_passive_session_pairs_by_category`
- `get_active_session_pairs_by_category`
- `get_passive_review_session_pairs_by_category`
- `get_active_review_session_pairs_by_category`
- `get_favorites_session_pairs`
- `get_favorites_session_pairs_by_category`
- `get_review_pairs`
- `dictionary_search`

All of the above return `word_target_audio_url` and `sentence_target_audio_url` from `public.pairs`.

### App server hydration paths

- `app/decks/[id]/practice/page.tsx`
  - Calls session RPCs.
  - If both audio fields are missing on a row, re-reads `pairs` for `pair_template_id`.
  - If still null, builds `pt-` fallback path via `buildTemplateAudioPath(...)`.
- `app/favorites/[lang]/practice/page.tsx`
  - Same missing-audio hydration and fallback strategy.

### Frontend playback paths

- Practice:
  - `app/decks/[id]/practice/PracticeClient.tsx`
  - `app/decks/[id]/practice/lib/usePracticeFlow.ts`
  - `app/decks/[id]/practice/lib/usePracticeDerived.ts`
  - `app/decks/[id]/practice/lib/usePreviewAudio.ts`
  - `app/decks/[id]/practice/lib/useAudioController.ts`
  - `app/decks/[id]/practice/lib/resolvePracticeAudioUrl.ts`
- Dictionary/header dictionary:
  - `app/api/dictionary-search/route.ts` (RPC returns audio URLs)
  - `app/dictionary/[lang]/DictionaryClient.tsx`
  - `app/components/DictionaryHeaderSearch.tsx`

## Known fallback paths

### Explicit `pt-` fallback

- Implemented in `app/decks/[id]/practice/lib/fallbackAudioPath.ts`.
- Format: `storage/v1/object/public/tts/{locale}/{kind}/pt-{pair_template_id}.mp3`.
- Used in both practice and favorites page hydration when both audio URL fields are null.

### URL-format fallback/normalization

- `resolvePracticeAudioUrl` accepts:
  - full `https://...`
  - `storage/v1/...`
  - `object/...`
  - paths containing `tts/...`
  - raw `tts/...` key

## Storage layout conventions currently in use

## Live storage (MCP inspection was possible)

- Bucket present: `storage.buckets.name = tts` (public).
- Sample object names confirm template keying pattern exists:
  - `en-GB/word/pt-<uuid>.mp3`
  - `en-GB/sentence/pt-<uuid>.mp3`
  - `es-ES/word/pt-<uuid>.mp3`
  - `es-ES/sentence/pt-<uuid>.mp3`
- Aggregate object mix in bucket:
  - `tts_objects`: 119,868
  - `pt` word objects (`%/word/pt-%`): 21,181
  - `pt` sentence objects (`%/sentence/pt-%`): 21,180
  - non-`pt` word objects: 38,783
  - non-`pt` sentence objects: 38,724

Interpretation: the bucket currently contains both legacy and canonical-style naming schemes.

## Null coverage and duplication patterns (live DB)

- `public.pairs` rows: 36,883
- Rows with both audio fields null: 2,687
- Rows recoverable by current app fallback inputs (`pair_template_id + mapped locale`): 2,687
- Rows truly missing by current fallback rules: 0
- `pair_template_id` null in `pairs`: 0

Template-level structure and duplication:

- `public.pair_templates` rows: 36,883
- Template IDs referenced by at least one `pairs` row: 10,538
- Template IDs with no referencing `pairs` rows: 26,345
- Templates shared by multiple `pairs` rows: 7,851
- Among referenced templates:
  - with any word audio in `pairs`: 7,851
  - with any sentence audio in `pairs`: 7,851
  - with no audio anywhere in `pairs`: 2,687
- For templates appearing in `pairs`, conflicting URLs are currently not observed:
  - templates with multiple distinct word URLs: 0
  - templates with multiple distinct sentence URLs: 0

## Likely duplication points

1. **Physical duplication (confirmed)**:
   - Audio URL metadata is repeated per `pairs` row even when representing the same `pair_template_id`.
2. **Logical duplication (currently consistent)**:
   - Multiple `pairs` rows per template usually carry the same URL values.
3. **Provisioning duplication pressure**:
   - Sync functions copy audio into newly inserted `pairs` rows by grouping existing `pairs` on `pair_template_id`.
4. **Storage-era duality**:
   - Both legacy (`pairs.id` style) and `pt-` style object namespaces coexist.

## User-owned state vs template-owned canonical content

### User-owned learning state (should remain user-scoped)

- `user_pairs` mastery/review timestamps
- `user_favorites` selections and direction/kind
- `user_pair_reviews`, `practice_sessions`, `user_usage_daily`, etc.

### Template-owned canonical content (should be canonicalized)

- Text content from `pair_templates` (`word_target`, `sentence_target`, etc.)
- Canonical audio identity should also be template-owned:
  - one row per `pair_template_id`
  - stable keys for word/sentence audio objects

## Long-term recommendation

Adopt a dedicated template-owned audio table as canonical source:

- `public.template_audio_assets(pair_template_id PK, word_audio_key, sentence_audio_key, created_at, updated_at)`

Then progressively move runtime reads toward:

1. resolve canonical key from `template_audio_assets`
2. derive final URL from storage key + project host
3. keep existing `pairs.*_audio_url` and current fallback behavior during migration window

This decouples user-row duplication from canonical content, while preserving current playback behavior until cutover is safe.

## Biggest architectural issue

Audio ownership is conceptually template-level but physically stored and queried as pair-row metadata (`public.pairs`), forcing duplication and fallback coupling between runtime hydration, provisioning SQL, and storage key conventions.

## Related code and SQL artifacts reviewed

- Practice hydration and fallback:
  - `app/decks/[id]/practice/page.tsx`
  - `app/favorites/[lang]/practice/page.tsx`
  - `app/decks/[id]/practice/lib/fallbackAudioPath.ts`
  - `app/decks/[id]/practice/lib/resolvePracticeAudioUrl.ts`
- Playback:
  - `app/decks/[id]/practice/PracticeClient.tsx`
  - `app/decks/[id]/practice/lib/usePracticeFlow.ts`
  - `app/decks/[id]/practice/lib/usePracticeDerived.ts`
  - `app/decks/[id]/practice/lib/usePreviewAudio.ts`
  - `app/decks/[id]/practice/lib/useAudioController.ts`
- Dictionary:
  - `app/api/dictionary-search/route.ts`
  - `app/dictionary/[lang]/DictionaryClient.tsx`
  - `app/components/DictionaryHeaderSearch.tsx`
- SQL/provisioning and runbooks:
  - `sql/sync_selected_content.sql`
  - `sql/sync_default_content_performance.sql`
  - `sql/backfill_pair_audio_urls_from_storage.sql`
  - `sql/AUDIO_REGENERATION_RUNBOOK.md`
  - `tts_batch_multi.js`
  - `tts_regenerate_canonical.js`
