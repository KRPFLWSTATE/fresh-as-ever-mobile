-- Optional pg_cron job: pickup reminder SMS ~45 minutes before pickup_start.
-- Requires pg_cron + pg_net (or invoke Edge Function from an external scheduler).
--
-- Replace YOUR_PROJECT and SERVICE_ROLE before running in Supabase SQL editor.

-- Example: select orders with pickup in the next hour and call Edge Function via http extension.
-- Prefer Supabase scheduled Edge Functions when pg_cron is unavailable.

-- select o.id, o.customer_id, o.reservation_code, o.pickup_start
-- from public.orders o
-- where o.order_status in ('paid', 'ready_for_pickup')
--   and o.pickup_start is not null
--   and o.pickup_start between now() + interval '30 minutes' and now() + interval '60 minutes';
