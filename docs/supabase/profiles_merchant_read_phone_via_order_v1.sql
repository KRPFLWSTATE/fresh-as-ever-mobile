-- profiles_merchant_read_phone_via_order_v1 (OPTIONAL — human review before apply)
--
-- Context: merchant `orders` list joins `customer:profiles(full_name, phone)`.
-- If `phone` is always null in production, RLS on `public.profiles` may be blocking
-- `phone` for non-self reads. This policy **adds** a permissive SELECT path for
-- merchant staff without removing existing self-read / admin policies.
--
-- Preconditions: `public.is_merchant_staff_for_outlet(uuid)` exists (see secdef_lockdown.sql).

drop policy if exists "profiles_phone_read_for_merchant_orders" on public.profiles;

create policy "profiles_phone_read_for_merchant_orders"
on public.profiles
for select
to authenticated
using (
  coalesce(phone, '') <> ''
  and exists (
    select 1
    from public.orders o
    where o.customer_id = profiles.id
      and public.is_merchant_staff_for_outlet(o.outlet_id)
  )
);
