import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { canPublishClearanceShelves, canPublishRescueBags } from '@/lib/outletListingMode';

const DEFAULT_VENUE_RATING = 0;

export type FavouriteOutlet = {
  id: string;
  name: string;
  rating: number;
  trustScore: number | null;
  averageRating: number | null;
  totalReviews: number | null;
  collectionRatePct: number | null;
  complaintRatePct: number | null;
  noShowRatePct: number | null;
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
  /** outlets.category — `bakery | cafe | restaurant | supermarket | other` (legacy `hotel`). */
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

  const outletCategory = typeof out.category === 'string' ? out.category : '';
  const bagMode = canPublishRescueBags(outletCategory);
  const shelfMode = canPublishClearanceShelves(outletCategory);
  const bags = bagMode
    ? ((out.rescue_bags as Record<string, unknown>[] | undefined) ?? [])
    : [];
  const liveBags = bags.filter((b) => {
    const s = String(b.status ?? '').toLowerCase();
    return s === 'live' || s === 'draft';
  });
  const bagsAvailable = liveBags.reduce((sum, b) => {
    const q =
      typeof b.quantity_remaining === 'number' ? b.quantity_remaining : 0;
    return sum + q;
  }, 0);

  const today = new Date().toISOString().slice(0, 10);
  const shelves = shelfMode
    ? ((out.clearance_shelves as Record<string, unknown>[] | undefined) ?? [])
    : [];
  const todayPublishedShelves = shelves.filter(
    (s) =>
      String(s.status ?? '').toLowerCase() === 'published' &&
      String(s.shelf_date ?? '') === today,
  );
  let shelfItemsAvailable = 0;
  let shelfListingsToday = 0;
  for (const shelf of todayPublishedShelves) {
    const items = (shelf.items as Record<string, unknown>[] | undefined) ?? [];
    const liveItems = items.filter(
      (i) => String(i.status ?? '').toLowerCase() === 'live',
    );
    if (liveItems.length > 0) shelfListingsToday += 1;
    shelfItemsAvailable += liveItems.reduce(
      (sum, i) => sum + Number(i.quantity_remaining ?? 0),
      0,
    );
  }

  const totalAvailable = bagsAvailable + shelfItemsAvailable;

  let status: FavouriteOutlet['status'];
  if (totalAvailable > 0) {
    status = 'selling_fast';
  } else if (liveBags.length > 0 || shelfListingsToday > 0) {
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
    trustScore:
      typeof out.trust_score === 'number'
        ? out.trust_score
        : out.trust_score != null
          ? Number(out.trust_score)
          : null,
    averageRating:
      typeof out.average_rating === 'number' ? out.average_rating : null,
    totalReviews:
      typeof out.total_reviews === 'number' ? out.total_reviews : null,
    collectionRatePct:
      typeof out.collection_rate_pct === 'number'
        ? out.collection_rate_pct
        : out.collection_rate_pct != null
          ? Number(out.collection_rate_pct)
          : null,
    complaintRatePct:
      typeof out.complaint_rate_pct === 'number'
        ? out.complaint_rate_pct
        : out.complaint_rate_pct != null
          ? Number(out.complaint_rate_pct)
          : null,
    noShowRatePct:
      typeof out.no_show_rate_pct === 'number'
        ? out.no_show_rate_pct
        : out.no_show_rate_pct != null
          ? Number(out.no_show_rate_pct)
          : null,
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
    bagsAvailable: totalAvailable,
    category: typeof out.category === 'string' ? out.category : null,
  };
}

export function useFavourites(
  env: AppEnv,
  customerId: string | null,
  userCoords: { lat: number; lng: number } | null = null,
) {
  const supabase = useMemo(() => getSupabase(env), [env]);

  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const favourites = useMemo(
    () =>
      rawRows
        .map((row) => mapOutletRow(row, userCoords))
        .filter(Boolean) as FavouriteOutlet[],
    [rawRows, userCoords?.lat, userCoords?.lng],
  );

  const fetchFavourites = useCallback(async (mode: 'full' | 'refresh' = 'full') => {
    try {
      if (mode === 'full' && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);

      if (!customerId) {
        setError(ERROR.favourites.signIn);
        setRawRows([]);
        hasLoadedOnceRef.current = false;
        setLoading(false);
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
            total_reviews,
            trust_score,
            collection_rate_pct,
            complaint_rate_pct,
            no_show_rate_pct,
            cover_image_url,
            location,
            rescue_bags (
              quantity_remaining,
              status
            ),
            clearance_shelves (
              shelf_date,
              status,
              items:clearance_shelf_items (
                quantity_remaining,
                status
              )
            )
          )
        `,
        )
        .eq('customer_id', customerId);

      if (fetchError) {
        throw fetchError;
      }

      setRawRows((data ?? []) as Record<string, unknown>[]);
      hasLoadedOnceRef.current = true;
    } catch (e) {
      logSupabaseError(e, 'useFavourites.fetchFavourites');
      setError(mapSupabaseError(e as Error, ERROR.favourites.load));
      setRawRows([]);
      hasLoadedOnceRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [customerId, supabase]);

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
      setRawRows((prev) =>
        prev.filter((row) => {
          const out = row.outlet as Record<string, unknown> | undefined;
          return String(out?.id ?? '') !== outletId;
        }),
      );
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
        trustScore: null,
        averageRating: null,
        totalReviews: null,
        collectionRatePct: null,
        complaintRatePct: null,
        noShowRatePct: null,
        distanceLabel: 'Nearby',
        image: null,
        status: 'selling_fast',
        bagsAvailable: 1,
        category: null,
      };
      setRawRows((prev) => [
        ...prev.filter((row) => {
          const out = row.outlet as Record<string, unknown> | undefined;
          return String(out?.id ?? '') !== outletId;
        }),
        {
          outlet: {
            id: outletId,
            name: optimistic.name,
            category: optimistic.category,
            average_rating: optimistic.averageRating,
            cover_image_url: optimistic.image,
          },
        },
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
