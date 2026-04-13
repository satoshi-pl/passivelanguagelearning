-- Allow authenticated users to read onboarding language metadata.
-- Required by app/setup/SetupDecksClient.tsx querying public.deck_templates.

grant select on table public.deck_templates to authenticated;

alter table public.deck_templates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deck_templates'
      and policyname = 'deck_templates_select_authenticated'
  ) then
    create policy deck_templates_select_authenticated
      on public.deck_templates
      for select
      to authenticated
      using (true);
  end if;
end
$$;
