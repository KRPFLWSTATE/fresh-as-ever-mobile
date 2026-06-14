import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';
import { resolveShelfItemCategory } from '@/lib/shelfBrowse';
import { useAuthContext } from '@/context/AuthContext';

const FETCH_TIMEOUT_MS = 20_000;
const AUTH_INIT_GRACE_MS = 8_000;

const SHELF_ITEM_COLUMNS =
  'id, status, quantity_remaining, name_snapshot, retail_price, rescue_price, best_before, brand_snapshot, image_url_snapshot, allergens_snapshot, is_halal';

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('shelf_fetch_timeout')), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
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
  const [authGraceExpired, setAuthGraceExpired] = useState(false);

  useEffect(() => {
    if (!authInitializing) {
      setAuthGraceExpired(false);
      return undefined;
    }
    const id = setTimeout(() => setAuthGraceExpired(true), AUTH_INIT_GRACE_MS);
    return () => clearTimeout(id);
  }, [authInitializing, shelfId]);

  const fetchShelf = useCallback(async () => {
    if (!shelfId) {
      setLoading(false);
      setShelf(null);
      setError(null);
      return;
    }
    if (authInitializing && !authGraceExpired) {
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
      let shelfQuery = supabase
        .from('clearance_shelves')
        .select(`
          *,
          outlet:outlets (
            id, name, category, is_halal_certified, trust_score,
            address, landmark, pickup_instructions, business_hours
          )
        `)
        .eq('id', shelfId);
      if (!merchantPreview) {
        shelfQuery = shelfQuery.eq('status', 'published');
      } else {
        shelfQuery = shelfQuery.in('status', ['draft', 'published']);
      }
      const { data: shelfRow, error: shelfErr } = await withTimeout(
        shelfQuery.maybeSingle(),
        FETCH_TIMEOUT_MS,
      );
      if (shelfErr) throw shelfErr;
      if (!shelfRow) throw new Error('shelf_not_found');

      const itemsQuery = supabase
        .from('clearance_shelf_items')
        .select(SHELF_ITEM_COLUMNS)
        .eq('shelf_id', shelfId)
        .in('status', ['live', 'sold_out']);
      const { data: itemRows, error: itemsErr } = await withTimeout(
        itemsQuery,
        FETCH_TIMEOUT_MS,
      );
      if (itemsErr) throw itemsErr;

      const items = ((itemRows ?? []) as Record<string, unknown>[]).map((i) => {
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
      setShelf({ ...shelfRow, items });
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
  }, [
    authGraceExpired,
    authInitializing,
    merchantPreview,
    session?.access_token,
    shelfId,
    supabase,
  ]);

  useEffect(() => {
    void fetchShelf();
  }, [fetchShelf]);

  return { shelf, loading, error, refresh: fetchShelf };
}
