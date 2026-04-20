-- Canonical template-owned audio metadata table.
-- Repo-only migration scaffold. Do not assume applied remotely.

create table if not exists public.template_audio_assets (
  pair_template_id uuid primary key
    references public.pair_templates(id)
    on delete cascade,
  word_audio_key text,
  sentence_audio_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.template_audio_assets is
  'Canonical audio keys (bucket-relative) owned by pair_template_id.';

comment on column public.template_audio_assets.word_audio_key is
  'Storage object key for template word audio (e.g. en-GB/word/pt-<id>.mp3).';

comment on column public.template_audio_assets.sentence_audio_key is
  'Storage object key for template sentence audio (e.g. en-GB/sentence/pt-<id>.mp3).';
