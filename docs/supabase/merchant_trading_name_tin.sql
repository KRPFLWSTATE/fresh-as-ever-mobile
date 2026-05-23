-- merchant_trading_name_tin_v1
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr`
-- (migration name `merchant_trading_name_tin_v1`).
--
-- Adds optional `trading_name` and `tin` (Taxpayer Identification Number)
-- columns to `public.merchants`. Surfaced on step 1 of `MerchantOnboarding`
-- to close the `merchant_onboarding_4_4` parity gap (the Stitch reference
-- prompts merchants for a trading name distinct from the legal name and a
-- TIN that gets shown on the review card).
--
-- Idempotent.

alter table public.merchants
  add column if not exists trading_name text;

alter table public.merchants
  add column if not exists tin text;
