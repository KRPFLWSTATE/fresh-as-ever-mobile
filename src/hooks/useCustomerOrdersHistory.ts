import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useAuthContext } from '@/context/AuthContext';
import { isCustomerOrderHistoryVisible } from '@/lib/customerRescueMetrics';
import { orderDisplayTitle } from '@/lib/orderDisplay';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type CustomerOrderHistoryRow = {
  id: string;
  reservation_code: string;
  total: number;
  created_at: string;
  order_status: string;
  payment_status: string;
  title: string;
  outlet_name: string;
};

export function useCustomerOrdersHistory(env: AppEnv, limit = 40) {
  const { user } = useAuthContext();
  const [rows, setRows] = useState<CustomerOrderHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase(env);
      const { data, error: qErr } = await sb
        .from('orders')
        .select(
          `
          id,
          reservation_code,
          total,
          created_at,
          order_status,
          payment_status,
          shelf_id,
          bag:rescue_bags(title),
          order_items(name_snapshot, quantity),
          outlet:outlets(name)
        `,
        )
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (qErr) throw qErr;

      setRows(
        ((data ?? []) as Record<string, unknown>[])
          .filter((r) =>
            isCustomerOrderHistoryVisible(
              String(r.order_status ?? ''),
              String(r.payment_status ?? ''),
            ),
          )
          .map((r) => ({
            id: String(r.id),
            reservation_code: String(r.reservation_code ?? ''),
            total: Number(r.total ?? 0),
            created_at: String(r.created_at ?? ''),
            order_status: String(r.order_status ?? ''),
            payment_status: String(r.payment_status ?? ''),
            title: orderDisplayTitle({
              shelf_id: r.shelf_id as string | null,
              bag: r.bag as { title?: string | null } | null,
              order_items: r.order_items as
                | { name_snapshot?: string | null; quantity?: number | null }[]
                | null,
            }),
            outlet_name: String((r.outlet as { name?: string | null } | null)?.name ?? ''),
          })),
      );
    } catch (e) {
      logSupabaseError(e, 'useCustomerOrdersHistory');
      setError(mapSupabaseError(e as Error, 'Could not load payment history.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [env, limit, user?.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return useMemo(
    () => ({ rows, loading, error, refetch }),
    [rows, loading, error, refetch],
  );
}
