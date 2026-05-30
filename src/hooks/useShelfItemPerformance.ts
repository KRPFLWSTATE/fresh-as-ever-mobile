import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';

export type ShelfItemPerformance = {
  shelf_item_id: string;
  name_snapshot: string;
  quantity_sold: number;
  revenue: number;
};

export function useShelfItemPerformance(
  env: AppEnv,
  outletId: string | null,
  shelfId: string | null,
) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [rows, setRows] = useState<ShelfItemPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!outletId || !shelfId) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('order_items')
        .select(
          `
          shelf_item_id,
          name_snapshot,
          quantity,
          line_total,
          order:orders!inner(outlet_id, shelf_id, order_status)
        `,
        )
        .eq('order.shelf_id', shelfId)
        .eq('order.outlet_id', outletId)
        .not('shelf_item_id', 'is', null);
      if (qErr) throw qErr;

      const agg = new Map<string, ShelfItemPerformance>();
      for (const raw of data ?? []) {
        const row = raw as Record<string, unknown>;
        const id = String(row.shelf_item_id ?? '');
        if (!id) continue;
        const qty = Number(row.quantity ?? 0);
        const rev = Number(row.line_total ?? 0);
        const existing = agg.get(id);
        if (existing) {
          existing.quantity_sold += qty;
          existing.revenue += rev;
        } else {
          agg.set(id, {
            shelf_item_id: id,
            name_snapshot: String(row.name_snapshot ?? 'Item'),
            quantity_sold: qty,
            revenue: rev,
          });
        }
      }
      setRows(
        [...agg.values()].sort((a, b) => b.quantity_sold - a.quantity_sold),
      );
    } catch (err) {
      setError(mapSupabaseError(err as Error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [outletId, shelfId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}
