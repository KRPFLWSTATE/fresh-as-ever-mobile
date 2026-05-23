import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

/**
 * Finance summary surfaced by `MerchantFinanceScreen`.
 *
 *  - `pending`   = sum of `net_payout` over `settlements` rows whose status is **not yet
 *                  settled** (`processing` / `pending`). Represents money the merchant has
 *                  earned but hasn't been transferred yet.
 *  - `paidOut`   = sum of `net_payout` over all settlements in `paid` / `completed` (aligned
 *                  with web `useMerchantFinance` and finance-metrics-definitions runbook).
 *  - `lifetime`  = gross from `orders` (paid OR collected), unchanged.
 */
export type FinanceSummary = {
  pending: string;
  paidOut: string;
  lifetime: string;
  /**
   * Stitch `merchant_finance_refined_*` shows a "+12% last month" trend pill in
   * the Total Earnings card. Computed as the percentage change between this
   * month's paid+collected gross and the prior calendar month's gross. `null` when
   * there's no prior-month baseline (e.g. brand-new merchant).
   */
  trendPercent: number | null;
};

const PENDING_STATUSES = new Set(['pending', 'processing']);
const SETTLED_STATUSES = new Set(['paid', 'completed']);

function formatLkr(n: number): string {
  return `Rs. ${Math.round(n).toLocaleString('en-LK')}`;
}

export function useMerchantFinance(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { activeOutlet, merchant, loading: contextLoading } = useMerchantContext(env);

  const [summary, setSummary] = useState<FinanceSummary>({
    pending: 'Rs. 0',
    paidOut: 'Rs. 0',
    lifetime: 'Rs. 0',
    trendPercent: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const outletId = activeOutlet?.id != null ? String(activeOutlet.id) : '';
      const merchantId = merchant?.id != null ? String(merchant.id) : '';
      if (!outletId && !merchantId) {
        setSummary({
          pending: 'Rs. 0',
          paidOut: 'Rs. 0',
          lifetime: 'Rs. 0',
          trendPercent: null,
        });
        return;
      }

      // Parallel: lifetime gross (orders) + settlements (pending vs paid split).
      const [ordersRes, settlementsRes] = await Promise.all([
        outletId
          ? supabase
              .from('orders')
              .select('total, payment_status, order_status, created_at')
              .eq('outlet_id', outletId)
          : Promise.resolve({ data: [], error: null } as const),
        merchantId
          ? supabase
              .from('settlements')
              .select('status, net_payout, period_end, created_at')
              .eq('merchant_id', merchantId)
              .order('period_end', { ascending: false, nullsFirst: false })
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (settlementsRes.error) throw settlementsRes.error;

      const validOrders = ((ordersRes.data ?? []) as Record<string, unknown>[]).filter((o) => {
        const paid = String(o.payment_status ?? '') === 'paid';
        const col = String(o.order_status ?? '') === 'collected';
        return paid || col;
      });
      const lifetimeSum = validOrders.reduce(
        (sum, o) => sum + Number(o.total ?? 0),
        0,
      );

      // Trend percent for the refined finance card. Compares this calendar month's
      // gross with last month's. Returns `null` when there's no baseline yet.
      const now = new Date();
      const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const lastStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      ).getTime();
      let thisMonthSum = 0;
      let lastMonthSum = 0;
      for (const o of validOrders) {
        const ts = typeof o.created_at === 'string' ? Date.parse(o.created_at) : NaN;
        if (!Number.isFinite(ts)) continue;
        const total = Number(o.total ?? 0);
        if (ts >= thisStart) thisMonthSum += total;
        else if (ts >= lastStart) lastMonthSum += total;
      }
      let trendPercent: number | null = null;
      if (lastMonthSum > 0) {
        trendPercent = Math.round(
          ((thisMonthSum - lastMonthSum) / lastMonthSum) * 100,
        );
      } else if (thisMonthSum > 0) {
        trendPercent = 100;
      }

      const settlementRows = ((settlementsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
        status: String(r.status ?? '').toLowerCase(),
        net_payout: Number(r.net_payout ?? 0),
        period_end:
          typeof r.period_end === 'string' ? r.period_end : null,
        created_at:
          typeof r.created_at === 'string' ? r.created_at : null,
      }));

      const pendingSum = settlementRows
        .filter((r) => PENDING_STATUSES.has(r.status))
        .reduce((s, r) => s + r.net_payout, 0);

      const paidOutSum = settlementRows
        .filter((r) => SETTLED_STATUSES.has(r.status))
        .reduce((s, r) => s + r.net_payout, 0);

      setSummary({
        pending: formatLkr(pendingSum),
        paidOut: formatLkr(paidOutSum),
        lifetime: formatLkr(lifetimeSum),
        trendPercent,
      });
    } catch (e) {
      logSupabaseError(e, 'useMerchantFinance.refetch');
      setError(mapSupabaseError(e as Error, 'Could not load finance data.'));
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, merchant?.id, supabase]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    refetch().catch((err) => logError(err, { context: 'useMerchantFinance.refetch' }));
  }, [contextLoading, refetch]);

  return {
    summary,
    loading: loading || contextLoading,
    error,
    refetch,
  };
}
