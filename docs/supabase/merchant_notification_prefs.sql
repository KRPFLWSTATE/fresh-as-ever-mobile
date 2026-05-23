-- APPLIED — migration `merchant_notification_prefs_v1` (Supabase project `odkbpeelvcdmlimdflbr`).
--
-- Adds two additive jsonb columns to `public.merchants` so `MerchantSettings` can persist
-- the Stitch-style toggles:
--   * Pickup & alerts:   `merchant_notification_prefs`  -- { pickup_alerts: bool, quiet_hours: bool }
--   * Security toggles:  `merchant_security_settings`   -- { require_password_to_publish: bool, two_factor_signin: bool }
--
-- Both columns default to `'{}'::jsonb` so existing rows are immediately readable and
-- writable. No RLS changes needed — the existing merchant RLS already gates writes by
-- `is_merchant_staff_for(merchant_id)` / `merchants.owner_id = auth.uid()` for selects.

alter table if exists public.merchants
  add column if not exists merchant_notification_prefs jsonb not null default '{}'::jsonb,
  add column if not exists merchant_security_settings jsonb not null default '{}'::jsonb;

comment on column public.merchants.merchant_notification_prefs is
  'Per-merchant pickup + alert preferences (e.g. {"pickup_alerts": true, "quiet_hours": false}). Owned/written by the merchant via MerchantSettings.';

comment on column public.merchants.merchant_security_settings is
  'Per-merchant publish/2FA toggles (e.g. {"require_password_to_publish": true, "two_factor_signin": false}). Owned/written by the merchant via MerchantSettings.';
