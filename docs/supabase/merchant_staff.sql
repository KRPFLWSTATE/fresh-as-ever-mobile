-- merchant_staff_v1
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr`
-- (migration name `merchant_staff_v1`).
--
-- Adds a lightweight staff-invitation table that powers the
-- `MerchantSettings → Staff accounts` modal sheet for parity with the Stitch
-- `merchant_settings_refined` HTML. The table records both **invited** and
-- **accepted** staff, scoped to a merchant. Owners (the existing
-- `merchants.owner_id` user) can list / insert rows; staff users see only
-- rows pointing at their own `user_id`.
--
-- Idempotent.

create table if not exists public.merchant_staff (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid references auth.users(id),
  invited_email text,
  display_name text,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_staff_merchant_id_idx
  on public.merchant_staff (merchant_id);

create index if not exists merchant_staff_user_id_idx
  on public.merchant_staff (user_id);

alter table public.merchant_staff enable row level security;

-- Owners read all their staff
drop policy if exists "merchant_staff owners read" on public.merchant_staff;
create policy "merchant_staff owners read"
  on public.merchant_staff
  for select
  using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_staff.merchant_id
        and m.owner_id = auth.uid()
    )
  );

-- Owners insert / update / delete their staff
drop policy if exists "merchant_staff owners write" on public.merchant_staff;
create policy "merchant_staff owners write"
  on public.merchant_staff
  for all
  using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_staff.merchant_id
        and m.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_staff.merchant_id
        and m.owner_id = auth.uid()
    )
  );

-- Staff member reads their own row
drop policy if exists "merchant_staff self read" on public.merchant_staff;
create policy "merchant_staff self read"
  on public.merchant_staff
  for select
  using (user_id = auth.uid());
