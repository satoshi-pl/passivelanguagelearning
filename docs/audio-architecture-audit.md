# PLL Audio Architecture Audit

## Status

This document is now primarily a **historical architecture audit** from the migration period.
It should not be read as the current runtime design.

## Current runtime architecture

- Inherited runtime audio is resolved from `public.template_audio_assets`.
- Pair-row fallback is removed.
- Synthesized `pt-*` fallback is removed.
- Provisioning leaves `public.pairs.word_target_audio_url` and
  `public.pairs.sentence_target_audio_url` as `NULL` for new rows.
- Practice and dictionary playback continue to use the stable
  `word_target_audio_url` / `sentence_target_audio_url` payload shape, but those
  values are now canonical-resolved at read time.

## What this document still helps with

- historical context for why audio ownership moved away from `public.pairs`
- understanding why canonical metadata was introduced
- reviewing the migration-era coupling between provisioning, storage naming, and
  runtime hydration

## Historical notes

The sections that originally described:

- `public.pairs.word_target_audio_url` / `sentence_target_audio_url` as the
  primary runtime source of truth
- synthesized `pt-{pair_template_id}` fallback as an active runtime layer
- provisioning-time inheritance of audio into new `pairs`

are now superseded by the completed canonical cutover.

## Current source-of-truth summary

### Runtime

1. `public.template_audio_assets.word_audio_key`
2. `public.template_audio_assets.sentence_audio_key`
3. browser URL normalization of canonical raw values before playback

### Provisioning

- provisioning does **not** inherit audio into `public.pairs`
- runtime hydration supplies canonical-resolved audio when needed

### Compatibility surfaces still present

- `public.pairs.word_target_audio_url`
- `public.pairs.sentence_target_audio_url`
- migration/repair SQL and scripts that still reference those columns

These remaining compatibility pieces should be treated as cleanup candidates, not
as evidence of current runtime ownership.
