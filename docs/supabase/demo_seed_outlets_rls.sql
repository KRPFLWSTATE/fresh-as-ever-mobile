-- demo_seed_outlets_rls_v1
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name `demo_seed_outlets_rls_v1`).
--
-- The `public.demo_seed_outlets` table is a static reference list used during demo seeding.
-- It had RLS disabled which Supabase flagged as an ERROR-level lint. Reads are restricted to
-- admins; no insert/update/delete policy is defined so writes are blocked for everyone via
-- the public API. Server-side service-role writes still work for seeding.
--
-- Idempotent (safe to re-run).

alter table public.demo_seed_outlets enable row level security;

drop policy if exists "Admins read demo_seed_outlets" on public.demo_seed_outlets;
create policy "Admins read demo_seed_outlets"
  on public.demo_seed_outlets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
