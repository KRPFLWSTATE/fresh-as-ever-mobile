import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';
import { ERROR } from '@/lib/messages/errors';
import {
  formatDistanceLabel,
  haversineKm,
  parseOutletLatLng,
} from '@/lib/geoDistance';

const DEFAULT_VENUE_RATING = 0;

export type FavouriteOutlet = {
  id: string;
  name: string;
  rating: number;
  distanceLabel: string;
  image: string | null;
  /**
   * `selling_fast` — at least one live/draft bag with `quantity_remaining > 0`.
   * `sold_out_today` — the outlet has live/draft bags listed today, but every
   *   bag is at `quantity_remaining = 0` (we sold the entire allotment).
   * `sold_out` — no live/draft bags listed at all for the outlet today.
   */
  status: 'selling_fast' | 'sold_out_today' | 'sold_out';
  bagsAvailable: number;
  /** outlets.category — `bakery | cafe | restaurant | supermarket | hotel | other`. */
  category: string | null;
};

function mapOutletRow(
  fav: Record<string, unknown>,
  userCoords: { lat: number; lng: number } | null,
): FavouriteOutlet | null {
  const out = fav.outlet as Record<string, unknown> | undefined;
  if (!out?.id) {
    return null;
  }

  const bags = (out.rescue_bags as Record<string, unknown>[] | undefined) ?? [];
  const liveBags = bags.filter((b) => {
    const s = String(b.status ?? '').toLowerCase();
    return s === 'live' || s === 'draft';
  });
  const bagsAvailable = liveBags.reduce((sum, b) => {
    const q =
      typeof b.quantity_remaining === 'number' ? b.quantity_remaining : 0;
    return sum + q;
  }, 0);

  let status: FavouriteOutlet['status'];
  if (bagsAvailable > 0) {
    status = 'selling_fast';
  } else if (liveBags.length > 0) {
    // Outlet listed bags today, but every live row is at qty 0 — sold out today.
    status = 'sold_out_today';
  } else {
    status = 'sold_out';
  }

  return {
    id: String(out.id),
    name: String(out.name ?? 'Outlet'),
    rating:
      typeof out.average_rating === 'number' && out.average_rating > 0
        ? out.average_rating
        : DEFAULT_VENUE_RATING,
    distanceLabel: (() => {
      if (!userCoords) return 'Distance unavailable';
      const outletCoords = parseOutletLatLng(out.location);
      if (!outletCoords) return 'Distance unavailable';
      return formatDistanceLabel(
        haversineKm(
          userCoords.lat,
          userCoords.lng,
          outletCoords.lat,
          outletCoords.lng,
        ),
      );
    })(),
    image:
      typeof out.cover_image_url === 'string' ? out.cover_image_url : null,
    status,
    bagsAvailable,
    category: typeof out.category === 'string' ? out.category : null,
  };
}

export function useFavourites(
  env: AppEnv,
  customerId: string | null,
  userCoords: { lat: number; lng: number } | null = null,
) {
  const supabase = useMemo(() => getSupabase(env), [env]);

  const [favourites, setFavourites] = useState<FavouriteOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavourites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!customerId) {
        setError(ERROR.favourites.signIn);
        setFavourites([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('favourite_outlets')
        .select(
          `
          outlet_id,
          outlet:outlets (
            id,
            name,
            category,
            average_rating,
            cover_image_url,
            location,
            rescue_bags (
              quantity_remaining,
              status
            )
          )
        `,
        )
        .eq('customer_id', customerId);

      if (fetchError) {
        throw fetchError;
      }

      const formatted = ((data ?? []) as Record<string, unknown>[])
        .map((row) => mapOutletRow(row, userCoords))
        .filter(Boolean) as FavouriteOutlet[];

      setFavourites(formatted);
    } catch (e) {
      logSupabaseError(e, 'useFavourites.fetchFavourites');
      setError(mapSupabaseError(e as Error, ERROR.favourites.load));
      setFavourites([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, supabase, userCoords]);

  useEffect(() => {
    fetchFavourites().catch((err) => logError(err, { context: 'useFavourites.fetchFavourites' }));
  }, [fetchFavourites]);

  const savedOutletIds = useMemo(
    () => new Set(favourites.map((f) => f.id)),
    [favourites],
  );

  const isSaved = useCallback(
    (outletId: string) => savedOutletIds.has(outletId),
    [savedOutletIds],
  );

  const removeFavourite = useCallback(
    async (outletId: string): Promise<{ error?: string }> => {
      if (!customerId) {
        return { error: 'Not signed in.' };
      }
      setFavourites((prev) => prev.filter((f) => f.id !== outletId));
      const { error: delErr } = await supabase
        .from('favourite_outlets')
        .delete()
        .match({ customer_id: customerId, outlet_id: outletId });

      if (delErr) {
        await fetchFavourites();
        return { error: delErr.message };
      }
      await fetchFavourites();
      return {};
    },
    [customerId, supabase, fetchFavourites],
  );

  const addFavourite = useCallback(
    async (outletId: string): Promise<{ error?: string }> => {
      if (!customerId || !outletId) {
        return { error: 'SIGN_IN_REQUIRED' };
      }

      const optimistic: FavouriteOutlet = {
        id: outletId,
        name: 'Outlet',
        rating: DEFAULT_VENUE_RATING,
        distanceLabel: 'Nearby',
        image: null,
        status: 'selling_fast',
        bagsAvailable: 1,
        category: null,
      };
      setFavourites((prev) => [
        ...prev.filter((f) => f.id !== outletId),
        optimistic,
      ]);

      const { error: insertError } = await supabase
        .from('favourite_outlets')
        .insert({
          customer_id: customerId,
          outlet_id: outletId,
        });
      if (insertError && insertError.code !== '23505') {
        await fetchFavourites().catch((err) => logError(err, { context: 'useFavourites.fetchFavourites' }));
        return { error: insertError.message };
      }
      await fetchFavourites();
      return {};
    },
    [customerId, supabase, fetchFavourites],
  );

  const toggleFavourite = useCallback(
    async (
      outletId: string,
    ): Promise<{ error?: string; nowSaved?: boolean }> => {
      if (isSaved(outletId)) {
        const r = await removeFavourite(outletId);
        return r.error ? r : { nowSaved: false };
      }
      const r = await addFavourite(outletId);
      return r.error ? r : { nowSaved: true };
    },
    [isSaved, removeFavourite, addFavourite],
  );

  return {
    favourites,
    loading,
    error,
    refetch: fetchFavourites,
    savedOutletIds,
    isSaved,
    removeFavourite,
    addFavourite,
    toggleFavourite,
  };
}
