-- platform_settings_public_read_flags_v1
-- Lets customer/merchant apps read the `flags` row for maintenance banner / signup gates.
-- Admin write policies remain unchanged.

drop policy if exists "Public read platform flags" on public.platform_settings;

create policy "Public read platform flags"
  on public.platform_settings
  for select
  to anon, authenticated
  using (key = 'flags');
