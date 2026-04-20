# PLL Audio Cleanup Path (Post Canonical Cutover)

## Current architecture status

- Runtime resolution is canonical-first:
  1. `template_audio_assets` keys
  2. `pairs.word_target_audio_url` / `pairs.sentence_target_audio_url`
  3. synthesized `pt-{pair_template_id}` fallback path
- Live validation currently shows:
  - canonical in use
  - pair fallback at zero
  - pt fallback at zero
  - missing audio at zero

This means behavior is healthy, but legacy compatibility layers still exist by design.

## Remaining dependencies and classification

## Still needed temporarily

- `lib/audio/hydrateCanonicalFirstAudio.ts`
  - still queries pair-row audio as a compatibility fallback when canonical keys are absent.
- `lib/audio/templateAudio.ts` fallback synthesis (`pt-*`)
  - retained as last-resort safety.
- Practice/dictionary UI types carrying `word_target_audio_url` and `sentence_target_audio_url`
  - keeps playback payload shape unchanged.
- `app/api/reports/route.ts` / report payload `audio_raw`
  - useful for issue triage during transition.

## Safe to reduce now (completed in this pass)

- Hydration read dependency reduced:
  - pair-row audio is now queried only for rows lacking canonical key coverage, instead of eagerly for all rows.
- Provisioning SQL in repo now prefers canonical keys:
  - `sql/sync_selected_content.sql`
  - `sql/sync_default_content_performance.sql`
  - both now use `template_audio_assets` first, with legacy pair-derived sources as fallback.

## Safe to remove later only after more validation

- Legacy pair-audio inheritance logic from `public.pairs` / `mv_pair_template_audio` in provisioning SQL.
- Runtime pair-row fallback read from hydrator.
- `pt-*` synthesized fallback path.
- Legacy runbooks and scripts centered on writing/repairing `pairs.*_audio_url`.
- Eventual schema deprecation of `pairs.word_target_audio_url` and `pairs.sentence_target_audio_url`.

## Recommended cleanup order

1. **Guardrail period (non-destructive):**
   - keep canonical-first resolver + all fallbacks.
   - repeatedly run `sql/audio_runtime_guardrails.sql` and `sql/audio_architecture_validation.sql`.
2. **Fallback confidence gate:**
   - require sustained zero for:
     - `word_pairs`, `sentence_pairs`
     - `word_pt_fallback`, `sentence_pt_fallback`
     - `word_missing`, `sentence_missing`
3. **Provisioning simplification:**
   - remove dependency on `mv_pair_template_audio` / pair-derived aggregate once confidence gate is met.
4. **Runtime simplification:**
   - remove pair-row fallback read from hydrator.
   - keep `pt-*` fallback for one additional release window.
5. **Final safety review:**
   - if guardrails remain stable, remove `pt-*` synthesis.
6. **Destructive phase planning (future, separate):**
   - migration plan to deprecate/drop `pairs` audio columns.
   - archive or retire legacy storage/object repair workflows.

## What should stay longer for safety

- Canonical guardrail queries in repo SQL.
- Report-level capture of resolved audio raw path.
- At least one compatibility fallback (preferably `pt-*`) during staged rollout windows.
