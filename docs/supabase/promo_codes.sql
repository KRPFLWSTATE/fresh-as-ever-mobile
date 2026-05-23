-- promo_codes — global admin-managed discount codes (checkout + AdminPromos)
-- Table typically created in remote project; this file documents expected shape.

-- Expected columns (verify via information_schema):
-- id uuid PK, code varchar unique, discount_type text, discount_value numeric,
-- min_order_value numeric, max_uses int, used_count int, valid_from/valid_until timestamptz,
-- is_active boolean, is_single_use_per_customer boolean, source text, created_at timestamptz

-- used_count increments via perfection_pass_v1 trigger on orders.payment_status → paid
