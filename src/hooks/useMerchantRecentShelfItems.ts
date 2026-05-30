import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import type { ShelfItemDraft } from '@/lib/merchantShelfForm';
import { mapSupabaseError } from '@/lib/supabaseError';

export type RecentShelfItemRow = ShelfItemDraft & { last_used_at?: string };

export function useMerchantRecentShelfItems(env: AppEnv, outletId: string | null) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [items, setItems] = useState<RecentShelfItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecent = useCallback(async () => {
    if (!outletId) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data: shelfRows, error: qErr } = await supabase
        .from('clearance_shelves')
        .select('id, items:clearance_shelf_items(*)')
        .eq('outlet_id', outletId)
        .order('updated_at', { ascending: false })
        .limit(15);
      if (qErr) throw qErr;
      const flat: Record<string, unknown>[] = [];
      for (const shelf of (shelfRows ?? []) as Record<string, unknown>[]) {
        const items = Array.isArray(shelf.items) ? (shelf.items as Record<string, unknown>[]) : [];
        for (const row of items) {
          if (row.status === 'removed') continue;
          flat.push(row);
        }
      }
      flat.sort((a, b) => {
        const ta = new Date(String(a.updated_at ?? 0)).getTime();
        const tb = new Date(String(b.updated_at ?? 0)).getTime();
        return tb - ta;
      });
      const seen = new Set<string>();
      const deduped: RecentShelfItemRow[] = [];
      for (const row of flat) {
        const key = `${row.barcode ?? ''}|${row.name_snapshot ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({
          product_id: typeof row.product_id === 'string' ? row.product_id : null,
          barcode: typeof row.barcode === 'string' ? row.barcode : null,
          name_snapshot: String(row.name_snapshot ?? ''),
          brand_snapshot:
            typeof row.brand_snapshot === 'string' ? row.brand_snapshot : null,
          image_url_snapshot:
            typeof row.image_url_snapshot === 'string' ? row.image_url_snapshot : null,
          allergens_snapshot: Array.isArray(row.allergens_snapshot)
            ? (row.allergens_snapshot as string[])
            : [],
          is_halal: typeof row.is_halal === 'boolean' ? row.is_halal : null,
          retail_price:
            typeof row.retail_price === 'number'
              ? row.retail_price
              : row.retail_price != null
                ? Number(row.retail_price)
                : null,
          rescue_price: Number(row.rescue_price ?? 100),
          quantity_total: 5,
          quantity_remaining: 5,
          last_used_at:
            typeof row.updated_at === 'string' ? row.updated_at : undefined,
        });
        if (deduped.length >= 12) break;
      }
      setItems(deduped);
    } catch (err) {
      setError(mapSupabaseError(err as Error));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [outletId, supabase]);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  return { items, loading, error, refresh: fetchRecent };
}
