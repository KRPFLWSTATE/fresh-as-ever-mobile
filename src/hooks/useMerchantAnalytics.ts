import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import {
  type AnalyticsWindowKey,
  aggregateHourBuckets,
  aggregateTopBags,
  countDistinctCustomers,
  cutoffIsoForWindow,
  estimateWasteKg,
  estimateShelfFoodKg,
  formatLkr,
  isCollectedOrder,
  peakHourLabel,
  sumRevenue,
  sumSurplusRecovered,
  type HourBucket,
  type TopSellingBag,
} from '@/lib/merchantAnalytics';
import { co2eKgFromFoodKg, resolveBagFoodWeightKg } from '@/lib/co2Impact';
import { ERROR } from '@/lib/messages/errors';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type MerchantAnalyticsSnapshot = {
  revenue: number;
  revenueLabel: string;
  customerReach: number;
  wasteKg: number;
  co2Kg: number;
  surplusRecovered: number;
  surplusRecoveredLabel: string;
  hourBuckets: HourBucket[];
  peakHour: string;
  topBags: TopSellingBag[];
};

export function useMerchantAnalytics(env: AppEnv, windowDays: AnalyticsWindowKey = 30) {
  const { outletScopeIds, loading: ctxLoading } = useMerchantContext(env);
  const [snapshot, setSnapshot] = useState<MerchantAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGen = useRef(0);

  const refetch = useCallback(async () => {
    const gen = ++fetchGen.current;
    if (outletScopeIds.length === 0) {
      setSnapshot({
        revenue: 0,
        revenueLabel: formatLkr(0),
        customerReach: 0,
        wasteKg: 0,
        co2Kg: 0,
        surplusRecovered: 0,
        surplusRecoveredLabel: formatLkr(0),
        hourBuckets: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
        peakHour: '—',
        topBags: [],
      });
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshot(null);
    const sb = getSupabase(env);
    const cutoff = cutoffIsoForWindow(windowDays);
    try {
      const { data, error: qErr } = await sb
        .from('orders')
        .select(
          `
          id,
          customer_id,
          bag_id,
          shelf_id,
          total,
          quantity,
          created_at,
          order_status,
          bag:rescue_bags(title, estimated_weight_kg, retail_value_estimate),
          order_items (
            quantity,
            line_total,
            unit_price,
            product:product_catalog(weight_grams)
          )
        `,
        )
        .in('outlet_id', outletScopeIds)
        .gte('created_at', cutoff)
        .limit(5000);

      if (qErr) throw qErr;
      if (gen !== fetchGen.current) return;

      const rows = (data ?? []) as Record<string, unknown>[];
      const collected = rows.filter((r) =>
        isCollectedOrder(String(r.order_status ?? '')),
      );
      const revenue = sumRevenue(collected);
      const reach = countDistinctCustomers(collected);
      const hourBuckets = aggregateHourBuckets(rows);
      const topBags = aggregateTopBags(
        collected.map((r) => ({
          bag_id: r.bag_id as string | null,
          total: r.total as number | string | null,
          quantity: r.quantity as number | null,
          bag: r.bag as { title?: string | null } | null,
        })),
      );

      const weightMap = new Map<string, number>();
      for (const r of collected) {
        const bagId = r.bag_id != null ? String(r.bag_id) : '';
        if (!bagId || weightMap.has(bagId)) continue;
        const bag = r.bag as {
          estimated_weight_kg?: number | null;
          retail_value_estimate?: number | null;
        } | null;
        weightMap.set(bagId, resolveBagFoodWeightKg(bag));
      }
      const wasteKg = (() => {
        let kg = estimateWasteKg(
          collected.map((r) => ({
            bag_id: r.bag_id as string | null,
            quantity: r.quantity as number | null,
          })),
          weightMap,
        );
        for (const r of collected) {
          if (r.shelf_id == null) continue;
          const lines = (r.order_items ?? []) as Record<string, unknown>[];
          kg += estimateShelfFoodKg(lines);
        }
        return Math.round(kg * 10) / 10;
      })();
      const co2Kg = co2eKgFromFoodKg(wasteKg);
      const surplusRecovered = sumSurplusRecovered(
        collected.map((r) => ({
          quantity: r.quantity as number | null,
          bag: r.bag as { retail_value_estimate?: number | null } | null,
        })),
      );

      setSnapshot({
        revenue,
        revenueLabel: formatLkr(revenue),
        customerReach: reach,
        wasteKg,
        co2Kg,
        surplusRecovered,
        surplusRecoveredLabel: formatLkr(surplusRecovered),
        hourBuckets,
        peakHour: peakHourLabel(hourBuckets),
        topBags,
      });
    } catch (e) {
      if (gen !== fetchGen.current) return;
      logSupabaseError(e, 'useMerchantAnalytics');
      setError(mapSupabaseError(e as Error, ERROR.merchant.analytics));
      setSnapshot(null);
    } finally {
      if (gen === fetchGen.current) {
        setLoading(false);
      }
    }
  }, [env, outletScopeIds, windowDays]);

  useEffect(() => {
    if (ctxLoading) return;
    void refetch();
  }, [ctxLoading, refetch]);

  return useMemo(
    () => ({
      snapshot,
      loading: loading || ctxLoading,
      error,
      refetch,
    }),
    [snapshot, loading, ctxLoading, error, refetch],
  );
}
