import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';
import { co2eKgFromBagRescue, co2eKgFromShelfOrderItems } from '@/lib/co2Impact';

export { KG_CO2E_PER_KG_FOOD } from '@/lib/co2Impact';

export function useCustomerImpact(env: AppEnv, customerId: string | null) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [bagsRescued, setBagsRescued] = useState(0);
  const [co2SavedKg, setCo2SavedKg] = useState(0);
  const [totalSavedRs, setTotalSavedRs] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      if (!customerId) {
        setBagsRescued(0);
        setCo2SavedKg(0);
        setTotalSavedRs(0);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select(
          `quantity, total, order_status, shelf_id,
          bag:rescue_bags(estimated_weight_kg, retail_value_estimate, rescue_price),
          order_items (
            quantity, line_total, unit_price,
            product:product_catalog (weight_grams)
          )`,
        )
        .eq('customer_id', customerId)
        .eq('order_status', 'collected');

      if (error) {
        throw error;
      }

      let rescueCount = 0;
      let saved = 0;
      let co2Total = 0;
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        if (row.shelf_id) {
          rescueCount += 1;
          const lines = (row.order_items ?? []) as Record<string, unknown>[];
          co2Total += co2eKgFromShelfOrderItems(lines);
          for (const line of lines) {
            const lineTotal = Number(line.line_total) || 0;
            const unit = Number(line.unit_price) || 0;
            const qty = Math.max(1, Number(line.quantity) || 1);
            saved += lineTotal > 0 ? lineTotal : unit * qty;
          }
        } else {
          const q = Math.max(1, Number(row.quantity) || 1);
          rescueCount += q;
          const bag =
            typeof row.bag === 'object' && row.bag != null
              ? (row.bag as Record<string, unknown>)
              : {};
          co2Total += co2eKgFromBagRescue(bag, q);
          const retail = Number(bag.retail_value_estimate) || 0;
          const rescue = Number(bag.rescue_price) || 0;
          if (retail > 0 && rescue >= 0) {
            saved += Math.max(0, retail - rescue) * q;
          }
        }
      }
      const roundedCo2 = Math.round(co2Total * 10) / 10;
      setBagsRescued(rescueCount);
      setCo2SavedKg(roundedCo2);
      setTotalSavedRs(Math.round(saved));
    } catch {
      setBagsRescued(0);
      setCo2SavedKg(0);
      setTotalSavedRs(0);
    } finally {
      setLoading(false);
    }
  }, [customerId, supabase]);

  useEffect(() => {
    refetch().catch((err) => logError(err, { context: 'useCustomerImpact.refetch' }));
  }, [refetch]);

  return { bagsRescued, co2SavedKg, totalSavedRs, loading, refetch };
}
