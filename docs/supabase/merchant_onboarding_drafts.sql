-- APPLIED — migration `merchant_onboarding_drafts_v1` (Supabase project `odkbpeelvcdmlimdflbr`).
--
-- Resumable per-user onboarding draft. The merchant onboarding screen upserts a single row
-- per auth user with the full draft state + the last completed step so a user can resume
-- from any step. Wraps `auth.uid()` RLS plus an admin-read policy for support.

create table if not exists public.merchant_onboarding_drafts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  step int not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.merchant_onboarding_drafts is
  'Resumable per-user onboarding draft. One row per auth user; the merchant onboarding screen upserts here on step transitions so a user can resume from any step.';

alter table public.merchant_onboarding_drafts enable row level security;

-- Policies wrap `auth.uid()` in a `(select auth.uid())` subquery so Postgres can lift the
-- call into the per-statement InitPlan instead of re-running it per row — closes the
-- `auth_rls_initplan` performance advisor flags for this table. (Migration
-- `merchant_onboarding_drafts_initplan_v1`, APPLIED; idempotently drop-and-recreate.)
drop policy if exists "owner can read own draft" on public.merchant_onboarding_drafts;
drop policy if exists "owner can upsert own draft" on public.merchant_onboarding_drafts;
drop policy if exists "owner can update own draft" on public.merchant_onboarding_drafts;
drop policy if exists "admin can read all drafts" on public.merchant_onboarding_drafts;

create policy "owner can read own draft"
  on public.merchant_onboarding_drafts
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "owner can upsert own draft"
  on public.merchant_onboarding_drafts
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "owner can update own draft"
  on public.merchant_onboarding_drafts
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "admin can read all drafts"
  on public.merchant_onboarding_drafts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Trigger function pins `search_path` to `pg_catalog, public` so the Supabase
-- `function_search_path_mutable` advisor stops complaining about role-inherited paths.
-- The body is pure (single `updated_at` stamp) so the pin is purely a hardening lint fix.
-- (Migration `merchant_onboarding_drafts_touch_search_path_v1`, APPLIED.)
create or replace function public.merchant_onboarding_drafts_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_merchant_onboarding_drafts_touch on public.merchant_onboarding_drafts;
create trigger trg_merchant_onboarding_drafts_touch
before update on public.merchant_onboarding_drafts
for each row
execute function public.merchant_onboarding_drafts_touch_updated_at();
