import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import {
  formatLkr,
  isCollectedOrder,
  sumSurplusRecovered,
} from '@/lib/merchantAnalytics';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type MerchantRecoveredRevenueSnapshot = {
  thisMonth: number;
  lastMonth: number;
  thisMonthLabel: string;
  trendPercent: number | null;
  thisMonthLabelFormatted: string;
  loading: boolean;
  error: string | null;
};

function normalizeBagJoin(
  bag: unknown,
): { retail_value_estimate?: number | string | null } | null {
  if (Array.isArray(bag)) {
    const first = bag[0];
    return first && typeof first === 'object'
      ? (first as { retail_value_estimate?: number | string | null })
      : null;
  }
  if (bag && typeof bag === 'object') {
    return bag as { retail_value_estimate?: number | string | null };
  }
  return null;
}

function monthBounds(offsetMonths: number): { start: number; end: number } {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths,
    1,
  ).getTime();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths + 1,
    1,
  ).getTime();
  return { start, end };
}

export function useMerchantRecoveredRevenue(env: AppEnv): MerchantRecoveredRevenueSnapshot {
  const { outletScopeIds, activeOutlet } = useMerchantContext(env);
  const supabase = useMemo(() => getSupabase(env), [env]);
  const scopeOutletIds = useMemo(
    () =>
      activeOutlet?.id != null
        ? [String(activeOutlet.id)]
        : outletScopeIds,
    [activeOutlet?.id, outletScopeIds],
  );
  const [thisMonth, setThisMonth] = useState(0);
  const [lastMonth, setLastMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const thisBounds = useMemo(() => monthBounds(0), []);
  const lastBounds = useMemo(() => monthBounds(-1), []);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, []);

  const fetchMetrics = useCallback(async () => {
    if (!scopeOutletIds.length) {
      setThisMonth(0);
      setLastMonth(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const earliest = new Date(lastBounds.start).toISOString();
      const { data, error: qErr } = await supabase
        .from('orders')
        .select(
          `
          id,
          quantity,
          created_at,
          order_status,
          shelf_id,
          bag:rescue_bags(retail_value_estimate),
          order_items(
            quantity,
            clearance_shelf_items(retail_price)
          )
        `,
        )
        .in('outlet_id', scopeOutletIds)
        .gte('created_at', earliest)
        .limit(8000);

      if (qErr) throw qErr;

      const rows = (data ?? []).filter((r) =>
        isCollectedOrder(
          typeof r.order_status === 'string' ? r.order_status : null,
        ),
      );

      const thisRows = rows.filter((r) => {
        const t = new Date(String(r.created_at)).getTime();
        return t >= thisBounds.start && t < thisBounds.end;
      });
      const lastRows = rows.filter((r) => {
        const t = new Date(String(r.created_at)).getTime();
        return t >= lastBounds.start && t < lastBounds.end;
      });

      const toSurplusRow = (r: (typeof rows)[number]) => ({
        quantity: r.quantity as number | null,
        bag: normalizeBagJoin(r.bag),
        order_items: Array.isArray(r.order_items)
          ? (r.order_items as {
              quantity?: number | null;
              clearance_shelf_items?: { retail_price?: number | null } | null;
            }[])
          : null,
      });

      setThisMonth(sumSurplusRecovered(thisRows.map(toSurplusRow)));
      setLastMonth(sumSurplusRecovered(lastRows.map(toSurplusRow)));
    } catch (e) {
      logSupabaseError(e, 'useMerchantRecoveredRevenue');
      setError(mapSupabaseError(e as Error, 'Could not load recovered revenue.'));
      setThisMonth(0);
      setLastMonth(0);
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    scopeOutletIds,
    thisBounds.start,
    thisBounds.end,
    lastBounds.start,
    lastBounds.end,
  ]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const trendPercent =
    lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0
        ? 100
        : null;

  return {
    thisMonth,
    lastMonth,
    thisMonthLabel: monthLabel,
    trendPercent,
    thisMonthLabelFormatted: formatLkr(thisMonth),
    loading,
    error,
  };
}
