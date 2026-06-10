import { useCallback, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';

export type ProductCatalogHit = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  image_url: string | null;
  allergens: string[];
  is_halal_hint: boolean | null;
  weight_grams: number | null;
  ingredients_summary: string | null;
};

export function useProductCatalogSearch(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [hits, setHits] = useState<ProductCatalogHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (q.length < 2) {
        setHits([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('product_catalog')
          .select(
            'id, name, brand, category, barcode, image_url, allergens, is_halal_hint, weight_grams, ingredients_summary',
          )
          .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
          .limit(8);
        if (error) throw error;
        setHits(
          (data ?? []).map((row) => ({
            id: String(row.id),
            name: String(row.name ?? ''),
            brand: typeof row.brand === 'string' ? row.brand : null,
            category: typeof row.category === 'string' ? row.category : null,
            barcode: typeof row.barcode === 'string' ? row.barcode : null,
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
            allergens: Array.isArray(row.allergens) ? (row.allergens as string[]) : [],
            is_halal_hint: row.is_halal_hint === true ? true : null,
            weight_grams:
              typeof row.weight_grams === 'number' ? row.weight_grams : null,
            ingredients_summary:
              typeof row.ingredients_summary === 'string'
                ? row.ingredients_summary
                : null,
          })),
        );
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  const clear = useCallback(() => setHits([]), []);

  return { hits, loading, search, clear };
}
