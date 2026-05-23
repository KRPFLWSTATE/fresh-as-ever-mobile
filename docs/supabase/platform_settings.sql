-- Additive migration: `public.platform_settings`
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name
-- `platform_settings`). This file is retained as the canonical schema reference.
--
-- Backs `AdminSystemSettingsScreen` (toggle persistence for maintenance mode /
-- merchant signups / fraud guard) and any future global flags. Single-row-per-key
-- key/value table guarded by admin-only RLS. Safe to re-run (IF NOT EXISTS +
-- ON CONFLICT + idempotent policy drops).

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.platform_settings enable row level security;

drop policy if exists "Admins read platform_settings" on public.platform_settings;
create policy "Admins read platform_settings"
  on public.platform_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins write platform_settings" on public.platform_settings;
create policy "Admins write platform_settings"
  on public.platform_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Seed defaults
insert into public.platform_settings (key, value)
values (
  'flags',
  jsonb_build_object(
    'maintenance', false,
    'merchant_signups', true,
    'fraud_guard_strict', true
  )
)
on conflict (key) do nothing;
