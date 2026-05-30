import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';

export function useShelfDetail(
  env: AppEnv,
  shelfId: string | undefined,
  options?: { merchantPreview?: boolean },
) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const merchantPreview = options?.merchantPreview === true;
  const [shelf, setShelf] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShelf = useCallback(async () => {
    if (!shelfId) return;
    try {
      setLoading(true);
      setError(null);
      let q = supabase
        .from('clearance_shelves')
        .select(`
          *,
          outlet:outlets (
            id, name, category, is_halal_certified,
            address, landmark, location, pickup_instructions, business_hours,
            merchant:merchants (business_name)
          ),
          items:clearance_shelf_items (
            *,
            product:product_catalog (category, ingredients_summary, source)
          )
        `)
        .eq('id', shelfId);
      if (!merchantPreview) {
        q = q.eq('status', 'published');
      } else {
        q = q.in('status', ['draft', 'published']);
      }
      const { data, error: qErr } = await q.maybeSingle();
      if (qErr) throw qErr;
      if (!data) throw new Error('shelf_not_found');
      const items = ((data.items ?? []) as Record<string, unknown>[])
        .filter((i) => i.status === 'live' || i.status === 'sold_out')
        .map((i) => {
          const product = i.product as Record<string, unknown> | undefined;
          return {
            ...i,
            catalog_category:
              typeof product?.category === 'string' ? product.category : null,
            ingredients_snapshot:
              typeof product?.ingredients_summary === 'string'
                ? product.ingredients_summary
                : null,
            catalog_source:
              typeof product?.source === 'string' ? product.source : null,
          };
        });
      setShelf({ ...data, items });
    } catch (err) {
      setError(mapSupabaseError(err as Error));
      setShelf(null);
    } finally {
      setLoading(false);
    }
  }, [merchantPreview, shelfId, supabase]);

  useEffect(() => {
    void fetchShelf();
  }, [fetchShelf]);

  return { shelf, loading, error, refresh: fetchShelf };
}
