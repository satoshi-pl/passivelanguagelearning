-- Allow authenticated runtime reads for canonical template audio metadata.
-- Keeps access scoped to templates that are actually present in the caller's decks.

grant select on table public.template_audio_assets to authenticated;

alter table public.template_audio_assets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'template_audio_assets'
      and policyname = 'template_audio_assets_select_authenticated_owned_templates'
  ) then
    create policy template_audio_assets_select_authenticated_owned_templates
      on public.template_audio_assets
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.pairs p
          join public.decks d on d.id = p.deck_id
          where p.pair_template_id = public.template_audio_assets.pair_template_id
            and d.user_id = auth.uid()
        )
      );
  end if;
end
$$;
