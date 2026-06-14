import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppEnv } from '@/config/env';
import { getSupabase } from '@/lib/supabase';
import {
  weeklyStreakProgress,
  type WeeklyStreakOrderRow,
} from '@/lib/customerWeeklyStreak';
import { CUSTOMER_IMPACT_ORDER_STATUSES } from '@/lib/customerRescueMetrics';

export function useCustomerWeeklyStreak(env: AppEnv, customerId: string | null) {
  const [orders, setOrders] = useState<WeeklyStreakOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!customerId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    const sb = getSupabase(env);
    const { data } = await sb
      .from('orders')
      .select('collected_at, created_at, order_status')
      .eq('customer_id', customerId)
      .in('order_status', [...CUSTOMER_IMPACT_ORDER_STATUSES])
      .order('collected_at', { ascending: false })
      .limit(40);
    setOrders((data ?? []) as WeeklyStreakOrderRow[]);
    setLoading(false);
  }, [customerId, env]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const streak = useMemo(() => weeklyStreakProgress(orders), [orders]);

  return { streak, loading, refetch };
}
