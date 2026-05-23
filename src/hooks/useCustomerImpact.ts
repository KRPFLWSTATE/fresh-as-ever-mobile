import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';

/**
 * Stitch `your_environmental_impact` methodology copy: 1 kg of rescued food averts
 * ~2.5 kg CO2e (Bag Weight Estimation: ~1 kg of food per rescued bag, hence ~2.5 kg
 * CO2e per bag). The screen surfaces this ratio in the prose and reflects it in the
 * equivalence cards (cars / phones / trees).
 */
export const KG_CO2_PER_RESCUED_BAG = 2.5;

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
          `quantity, total, order_status, bag:rescue_bags(retail_value_estimate, rescue_price)`,
        )
        .eq('customer_id', customerId)
        .eq('order_status', 'collected');

      if (error) {
        throw error;
      }

      let bagUnits = 0;
      let saved = 0;
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const q = Math.max(1, Number(row.quantity) || 1);
        bagUnits += q;
        const bag =
          typeof row.bag === 'object' && row.bag != null
            ? (row.bag as Record<string, unknown>)
            : {};
        const retail = Number(bag.retail_value_estimate) || 0;
        const rescue = Number(bag.rescue_price) || 0;
        if (retail > 0 && rescue >= 0) {
          saved += Math.max(0, retail - rescue) * q;
        }
      }
      const roundedCo2 =
        Math.round(bagUnits * KG_CO2_PER_RESCUED_BAG * 10) / 10;
      setBagsRescued(bagUnits);
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
