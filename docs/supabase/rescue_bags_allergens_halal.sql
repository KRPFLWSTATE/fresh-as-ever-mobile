-- rescue_bags_allergens_halal_v1
--
-- Related: complaints embed uses `reporter:profiles!complaints_reporter_id_fkey`
-- (Postgres default FK name for complaints.reporter_id → profiles.id).
-- Additive columns for structured allergen + halal metadata on rescue bags.
-- Idempotent: safe to re-run in staging / production.

alter table public.rescue_bags
  add column if not exists allergens text[] not null default '{}',
  add column if not exists is_halal boolean;

comment on column public.rescue_bags.allergens is
  'Declared allergens for this listing (e.g. Gluten, Dairy). Empty array = unspecified.';

comment on column public.rescue_bags.is_halal is
  'When true, merchant certifies halal suitability for this bag; null = not specified.';
