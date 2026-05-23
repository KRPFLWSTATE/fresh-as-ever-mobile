-- Optional: merchant-facing promotions (Stitch `promo_management`).
-- Apply in Supabase SQL editor when enabling RN promo tabs.

create table if not exists public.merchant_promotions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  title text not null default '',
  discount_label text not null default '',
  status text not null check (status in ('active', 'scheduled', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.merchant_promotions enable row level security;

-- Adjust policies to match your auth model (example: merchant sees own outlet).
-- create policy "merchant_promotions_select" on public.merchant_promotions
--   for select using (auth.uid() is not null);
