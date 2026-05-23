-- secdef_lockdown_v1
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name `secdef_lockdown_v1`).
--
-- Revoke EXECUTE on every SECURITY DEFINER helper/trigger function in the `public` schema so
-- they can no longer be invoked via PostgREST RPC (`/rest/v1/rpc/<name>`). Trigger functions
-- continue to fire because Postgres invokes them directly when the table is modified — those
-- invocations bypass role privilege checks.
--
-- Functions the app actually calls keep EXECUTE for `authenticated` but lose it for
-- `anon` / `public`. These intentionally remain as advisor warnings (level WARN, lint
-- 0029_authenticated_security_definer_function_executable) because the app depends on them:
--   - mark_order_no_show(uuid)             -> useMerchantOrders.markNoShow + MerchantOrderDetail
--   - nearby_bags(double, double, double)  -> useNearbyBags (customer Discover tab)
--   - is_admin()                            -> evaluated from inside RLS policies under `authenticated`
--   - is_merchant_staff_for(uuid)           -> RLS helper
--   - is_merchant_staff_for_outlet(uuid)    -> RLS helper
--
-- Functions that are only fired by triggers (no app-level RPC consumer) have EXECUTE revoked
-- from everyone:
--   - decrement_bag_quantity
--   - restore_bag_quantity
--   - update_outlet_rating
--   - handle_merchant_cancellation
--   - handle_new_user
--   - handle_no_show
--
-- PostGIS `st_estimatedextent(...)` (three overloads) is intentionally left untouched. It's a
-- system extension function we do not own; revoking would risk PostGIS internals. It remains
-- as an accepted advisor warning. The `extension_in_public` warning for `postgis` is similarly
-- accepted (PostGIS deployment convention).

-- ---------------------------------------------------------------------------
-- Trigger-only helpers (no RPC consumers) — revoke from everyone.
-- ---------------------------------------------------------------------------
revoke all on function public.decrement_bag_quantity() from public, anon, authenticated;
revoke all on function public.restore_bag_quantity() from public, anon, authenticated;
revoke all on function public.update_outlet_rating() from public, anon, authenticated;
revoke all on function public.handle_merchant_cancellation() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_no_show() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS helpers + app-invoked RPCs — revoke from anon/public, keep authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_merchant_staff_for(uuid) from public, anon;
grant execute on function public.is_merchant_staff_for(uuid) to authenticated;

revoke all on function public.is_merchant_staff_for_outlet(uuid) from public, anon;
grant execute on function public.is_merchant_staff_for_outlet(uuid) to authenticated;

revoke all on function public.mark_order_no_show(uuid) from public, anon;
grant execute on function public.mark_order_no_show(uuid) to authenticated;

revoke all on function public.nearby_bags(double precision, double precision, double precision) from public, anon;
grant execute on function public.nearby_bags(double precision, double precision, double precision) to authenticated;
