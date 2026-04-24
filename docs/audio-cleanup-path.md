# PLL Audio Cleanup Path

## Current architecture status

- Runtime inherited audio is canonical-only:
  1. `template_audio_assets.word_audio_key`
  2. `template_audio_assets.sentence_audio_key`
- Pair-row fallback is removed.
- Synthesized `pt-{pair_template_id}` fallback is removed.
- Provisioning does not write inherited audio into new `pairs`.
- Practice and dictionary playback both use canonical-resolved values with the
  existing payload field names.

## What is still intentionally present

- `word_target_audio_url` / `sentence_target_audio_url` remain the transport
  field names in app payloads.
- `public.pairs.word_target_audio_url` /
  `public.pairs.sentence_target_audio_url` still exist for compatibility,
  repair tooling, and later schema cleanup.
- Guardrail and validation SQL still expose legacy fallback buckets as
  diagnostic categories.
- Repair and regeneration scripts remain available for emergency use.

## Cleanup categories

### Safe-now cleanup

- stale docs and migration comments that still describe pair fallback or `pt-*`
  fallback as active runtime behavior
- validation query wording that still sounds like those buckets are live runtime
  tiers
- low-risk redundant runtime reads that no longer affect canonical hydration
- obviously dead/unused helper exports

### Later cleanup

- legacy pair-audio repair SQL/scripts
- storage deletion tooling and object cleanup
- schema retirement of `pairs.word_target_audio_url` and
  `pairs.sentence_target_audio_url`

## Recommended order

1. Docs/comments/query wording cleanup
2. Low-risk runtime cleanup
3. Script/runbook reclassification (keep vs historical vs emergency)
4. Storage cleanup planning and staged dry-run review
5. Schema cleanup in a separate later phase

## Safety note

Even though runtime no longer depends on pair-row or synthesized fallback
behavior, cleanup should continue to preserve:

- repair script availability
- query usefulness for diagnostics
- easy rollback for non-destructive cleanup passes
