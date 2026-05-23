import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { logError } from '@/observability/logError';

/**
 * Settlement row scoped to the active merchant. Mirrors a subset of the columns shown in
 * `AdminSettlementsScreen` / `AdminSettlementDetailScreen` so the same `statusPillTokens`
 * vocabulary can be reused on the merchant surface.
 */
export type MerchantSettlementRow = {
  id: string;
  status: string;
  net_payout: number;
  gross_sales: number;
  commission_amount: number;
  total_orders: number;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
};

export type MerchantSettlementDetail = MerchantSettlementRow & {
  card_processing_fees: number;
  card_orders_count: number;
  cash_orders_count: number;
  notes: string;
  payout_method: string;
  bank_details: Record<string, unknown> | null;
};

/**
 * Lists settlements for the currently signed-in merchant. RLS is expected to limit visibility
 * to merchants the user owns (see `docs/supabase/settlements.sql`). Returns `rows` ordered
 * newest-first and exposes `refetch` for pull-to-refresh.
 */
export function useMerchantSettlements(env: AppEnv, limit = 5) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { merchant, loading: ctxLoading } = useMerchantContext(env);

  const [rows, setRows] = useState<MerchantSettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const merchantId = merchant?.id ? String(merchant.id) : '';
    if (!merchantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('settlements')
      .select(
        'id, status, net_payout, gross_sales, commission_amount, total_orders, created_at, period_start, period_end',
      )
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (e) {
      setError(e.message);
      setRows([]);
    } else {
      const mapped: MerchantSettlementRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ''),
        status: String(r.status ?? 'pending'),
        net_payout: Number(r.net_payout ?? 0),
        gross_sales: Number(r.gross_sales ?? 0),
        commission_amount: Number(r.commission_amount ?? 0),
        total_orders: Number(r.total_orders ?? 0),
        created_at: typeof r.created_at === 'string' ? r.created_at : null,
        period_start: typeof r.period_start === 'string' ? r.period_start : null,
        period_end: typeof r.period_end === 'string' ? r.period_end : null,
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [supabase, merchant?.id, limit]);

  useEffect(() => {
    if (ctxLoading) return;
    refetch().catch((err) => logError(err, { context: 'useMerchantSettlements.refetch' }));
  }, [ctxLoading, refetch]);

  return {
    rows,
    loading: loading || ctxLoading,
    error,
    merchantId: merchant?.id ? String(merchant.id) : null,
    refetch,
  };
}
