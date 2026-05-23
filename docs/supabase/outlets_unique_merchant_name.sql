-- Additive migration: unique constraint on `public.outlets (merchant_id, name)`.
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name `outlets_unique_merchant_name_v1`).
-- Retained here as the canonical reference. Safe to re-run (DO NOTHING when present).
--
-- Powers MerchantOnboarding step-2 outlet persistence: after the `merchants` upsert succeeds,
-- the screen `.upsert(payload, { onConflict: 'merchant_id,name' })` on `public.outlets` so the
-- (merchant_id, outlet name) row is idempotent across retries.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.outlets'::regclass
      and conname = 'outlets_merchant_id_name_key'
  ) then
    alter table public.outlets
      add constraint outlets_merchant_id_name_key unique (merchant_id, name);
  end if;
end $$;
