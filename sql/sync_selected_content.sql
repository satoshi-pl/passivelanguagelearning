-- Provision only user-selected language pairs during onboarding.
-- If pairs are inserted with null audio URLs, run sql/backfill_pair_audio_urls_from_storage.sql
-- (or TTS scripts) so rows have URLs; then the audio_src aggregate below can propagate by pair_template_id.
-- p_pairs format:
-- [
--   { "target_lang": "es", "native_lang": "en" },
--   { "target_lang": "de", "native_lang": "en" }
-- ]

create or replace function public.sync_selected_content_for_user(
  p_user_id uuid,
  p_pairs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) = 0 then
    raise exception 'At least one language pair is required';
  end if;

  with requested_pairs as (
    select distinct
      lower(trim(value->>'target_lang')) as target_lang,
      lower(trim(value->>'native_lang')) as native_lang
    from jsonb_array_elements(p_pairs)
    where coalesce(value->>'target_lang', '') <> ''
      and coalesce(value->>'native_lang', '') <> ''
  )
  insert into public.decks (
    user_id,
    deck_template_id,
    name,
    target_lang,
    native_lang,
    level
  )
  select
    p_user_id,
    dt.id,
    dt.name,
    dt.target_lang,
    dt.native_lang,
    dt.level
  from public.deck_templates dt
  join requested_pairs rp
    on lower(dt.target_lang) = rp.target_lang
   and lower(dt.native_lang) = rp.native_lang
  left join public.decks d
    on d.user_id = p_user_id
   and d.deck_template_id = dt.id
  where d.id is null;

  with requested_pairs as (
    select distinct
      lower(trim(value->>'target_lang')) as target_lang,
      lower(trim(value->>'native_lang')) as native_lang
    from jsonb_array_elements(p_pairs)
    where coalesce(value->>'target_lang', '') <> ''
      and coalesce(value->>'native_lang', '') <> ''
  )
  insert into public.pairs (
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
  select
    d.id as deck_id,
    pt.id as pair_template_id,
    pt.word_target,
    pt.word_native,
    pt.sentence_target,
    pt.sentence_native,
    audio_src.word_target_audio_url,
    audio_src.sentence_target_audio_url,
    pt.category
  from public.pair_templates pt
  join public.decks d
    on d.user_id = p_user_id
   and d.deck_template_id = pt.deck_template_id
  join public.deck_templates dt
    on dt.id = d.deck_template_id
  join requested_pairs rp
    on lower(dt.target_lang) = rp.target_lang
   and lower(dt.native_lang) = rp.native_lang
  left join public.pairs p
    on p.deck_id = d.id
   and p.pair_template_id = pt.id
  left join (
    select
      pair_template_id,
      max(word_target_audio_url) as word_target_audio_url,
      max(sentence_target_audio_url) as sentence_target_audio_url
    from public.pairs
    where word_target_audio_url is not null
       or sentence_target_audio_url is not null
    group by pair_template_id
  ) audio_src
    on audio_src.pair_template_id = pt.id
  where p.id is null;
end;
$function$;

create or replace function public.sync_selected_content(p_pairs jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  select public.sync_selected_content_for_user(auth.uid(), p_pairs);
$$;
