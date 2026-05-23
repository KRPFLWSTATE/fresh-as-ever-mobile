-- Additive migrations: promo redemption caps + merchant outlet photos
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr`
-- (migration name `merchant_promotions_caps_and_merchant_photos`).
--
-- - Adds `max_uses` (nullable), `used_count` (default 0) and `min_order_value` (default 0)
--   to `public.merchant_promotions`. Used by `MerchantPromotionsScreen` to capture
--   redemption caps + minimum spend in the inline create form, and to render
--   "X / cap uses" + "Min Rs. N" lines on promo cards.
-- - Adds `outlet_photos text[]` to `public.merchants` so application review can show
--   the storefront/outlet photos bento. Existing rows default to an empty array.

alter table public.merchant_promotions
  add column if not exists max_uses integer,
  add column if not exists used_count integer not null default 0,
  add column if not exists min_order_value numeric not null default 0;

comment on column public.merchant_promotions.max_uses is
  'Optional total redemption cap. NULL = unlimited.';
comment on column public.merchant_promotions.used_count is
  'Number of times the promo has been redeemed.';
comment on column public.merchant_promotions.min_order_value is
  'Minimum cart value (LKR) required to apply the promo.';

alter table public.merchants
  add column if not exists outlet_photos text[] not null default '{}'::text[];

comment on column public.merchants.outlet_photos is
  'Array of public photo URLs uploaded during application review (storefront/outlet).';
