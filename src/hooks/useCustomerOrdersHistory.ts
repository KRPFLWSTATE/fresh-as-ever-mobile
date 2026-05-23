import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useAuthContext } from '@/context/AuthContext';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type CustomerOrderHistoryRow = {
  id: string;
  reservation_code: string;
  total: number;
  created_at: string;
  order_status: string;
  payment_status: string;
  bag_title: string;
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
          bag:rescue_bags(title),
          outlet:outlets(name)
        `,
        )
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (qErr) throw qErr;

      setRows(
        ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          reservation_code: String(r.reservation_code ?? ''),
          total: Number(r.total ?? 0),
          created_at: String(r.created_at ?? ''),
          order_status: String(r.order_status ?? ''),
          payment_status: String(r.payment_status ?? ''),
          bag_title: String((r.bag as { title?: string } | null)?.title ?? 'Rescue bag'),
          outlet_name: String((r.outlet as { name?: string } | null)?.name ?? ''),
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
