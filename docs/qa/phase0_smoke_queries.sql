-- Phase 0 runtime smoke queries (run on staging; paste results into PERFECTION_PASS_MCP_GATES.md)
-- Project: odkbpeelvcdmlimdflbr

-- 1) Oversell guard: pick a live bag with qty >= 1, note id, then attempt illegal decrement.
--    Expect trigger/RPC to reject going below zero (adjust function name if your project differs).
select id, quantity_remaining, status
from public.rescue_bags
where status = 'live' and quantity_remaining > 0
order by created_at desc
limit 1;

-- Manual: update rescue_bags set quantity_remaining = quantity_remaining - 999 where id = '<id>';
-- Expected: error or quantity_remaining stays >= 0

-- 2) Promo used_count: after a paid order with promo_code_id, promotion title should match promo_codes.code
select mp.id, mp.title, mp.used_count, pc.code, pc.used_count as promo_codes_used
from public.merchant_promotions mp
left join public.promo_codes pc on lower(trim(pc.code)) = lower(trim(mp.title))
order by mp.updated_at desc nulls last
limit 10;

-- 3) Advisors snapshot (run get_advisors via MCP after schema changes)
-- Security + performance advisors should show no new critical RLS regressions from perfection migrations.
