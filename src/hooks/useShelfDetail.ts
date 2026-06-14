import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';
import { resolveShelfItemCategory } from '@/lib/shelfBrowse';
import { useAuthContext } from '@/context/AuthContext';

const FETCH_TIMEOUT_MS = 20_000;

const SHELF_ITEM_COLUMNS =
  'id, status, quantity_remaining, name_snapshot, retail_price, rescue_price, best_before, brand_snapshot, image_url_snapshot, allergens_snapshot, is_halal';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('shelf_fetch_timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useShelfDetail(
  env: AppEnv,
  shelfId: string | undefined,
  options?: { merchantPreview?: boolean },
) {
  const { initializing: authInitializing, session } = useAuthContext();
  const supabase = useMemo(() => getSupabase(env), [env]);
  const merchantPreview = options?.merchantPreview === true;
  const [shelf, setShelf] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(Boolean(shelfId));
  const [error, setError] = useState<string | null>(null);

  const fetchShelf = useCallback(async () => {
    if (!shelfId) {
      setLoading(false);
      setShelf(null);
      setError(null);
      return;
    }
    if (authInitializing) {
      setLoading(true);
      setError(null);
      return;
    }
    if (!merchantPreview && !session?.access_token) {
      setLoading(false);
      setError('Sign in to view this clearance shelf.');
      setShelf(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      let q = supabase
        .from('clearance_shelves')
        .select(`
          *,
          outlet:outlets (
            id, name, category, is_halal_certified, trust_score,
            address, landmark, pickup_instructions, business_hours
          ),
          items:clearance_shelf_items (${SHELF_ITEM_COLUMNS})
        `)
        .eq('id', shelfId);
      if (!merchantPreview) {
        q = q.eq('status', 'published');
      } else {
        q = q.in('status', ['draft', 'published']);
      }
      const { data, error: qErr } = await withTimeout(q.maybeSingle(), FETCH_TIMEOUT_MS);
      if (qErr) throw qErr;
      if (!data) throw new Error('shelf_not_found');
      const items = ((data.items ?? []) as Record<string, unknown>[])
        .filter((i) => i.status === 'live' || i.status === 'sold_out')
        .map((i) => {
          const rowAllergens = Array.isArray(i.allergens_snapshot)
            ? (i.allergens_snapshot as string[])
            : [];
          return {
            ...i,
            catalog_category: resolveShelfItemCategory(i),
            ingredients_snapshot: null,
            catalog_source: 'Shop listing',
            allergens_snapshot: rowAllergens,
          };
        });
      setShelf({ ...data, items });
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'shelf_fetch_timeout'
          ? 'Shelf took too long to load. Pull to refresh or try again.'
          : mapSupabaseError(err as Error);
      setError(message);
      setShelf(null);
    } finally {
      setLoading(false);
    }
  }, [authInitializing, merchantPreview, session?.access_token, shelfId, supabase]);

  useEffect(() => {
    void fetchShelf();
  }, [fetchShelf]);

  return { shelf, loading, error, refresh: fetchShelf };
}
