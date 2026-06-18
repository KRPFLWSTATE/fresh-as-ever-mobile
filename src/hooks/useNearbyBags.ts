import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
import { fetchPublishedShelves, mergeDiscoverFeed } from '@/lib/discoverFeed';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';
import { ERROR } from '@/lib/messages/errors';

export type DiscoverBag = {
  id: string;
  title: string;
  rescue_price: number;
  outlet_id?: string | null;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  outlet_name?: string | null;
  /** Neighbourhood / landmark label from `outlets.landmark` (F3). */
  landmark?: string | null;
  outlet_landmark?: string | null;
  /**
   * Distance from the user's current location to the outlet, in kilometres. Returned by
   * the `nearby_bags` RPC. Null on the fallback path (no client geolocation yet).
   */
  distance_km?: number | null;
  quantity_remaining?: number | null;
  category?: string | null;
  outlet_category?: string | null;
  image_url?: string | null;
  retail_value_estimate?: number | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
  pickup_window_kind?: string | null;
  trust_score?: number | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  collection_rate_pct?: number | null;
  complaint_rate_pct?: number | null;
  no_show_rate_pct?: number | null;
  occasion_kind?: string | null;
};

async function enrichBagsWithOutletCoords(
  supabase: ReturnType<typeof getSupabase>,
  bags: DiscoverBag[],
): Promise<DiscoverBag[]> {
  const outletIds = [
    ...new Set(
      bags
        .filter(
          (b) =>
            b.outlet_id &&
            (b.outlet_lat == null ||
              b.outlet_lng == null ||
              !Number.isFinite(b.outlet_lat) ||
              !Number.isFinite(b.outlet_lng)),
        )
        .map((b) => b.outlet_id as string),
    ),
  ];
  if (!outletIds.length) return bags;

  const { data, error } = await supabase
    .from('outlets')
    .select('id, location')
    .in('id', outletIds);

  if (error || !data?.length) return bags;

  const coordsByOutlet = new Map<string, { lat: number; lng: number }>();
  for (const row of data as Record<string, unknown>[]) {
    const parsed = parseOutletCoords(row.location);
    if (parsed) {
      coordsByOutlet.set(String(row.id), parsed);
    }
  }

  return bags.map((bag) => {
    if (!bag.outlet_id) return bag;
    if (
      typeof bag.outlet_lat === 'number' &&
      typeof bag.outlet_lng === 'number' &&
      Number.isFinite(bag.outlet_lat) &&
      Number.isFinite(bag.outlet_lng)
    ) {
      return bag;
    }
    const coords = coordsByOutlet.get(bag.outlet_id);
    if (!coords) return bag;
    return {
      ...bag,
      outlet_lat: coords.lat,
      outlet_lng: coords.lng,
    };
  });
}

async function enrichBagsWithOutletTrust(
  supabase: ReturnType<typeof getSupabase>,
  bags: DiscoverBag[],
): Promise<DiscoverBag[]> {
  const outletIds = [
    ...new Set(
      bags.map((b) => b.outlet_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!outletIds.length) return bags;

  const { data, error } = await supabase
    .from('outlets')
    .select(
      'id, trust_score, average_rating, total_reviews, collection_rate_pct, complaint_rate_pct, no_show_rate_pct',
    )
    .in('id', outletIds);

  if (error || !data?.length) return bags;

  const byId = new Map(
    (data as Record<string, unknown>[]).map((row) => [String(row.id), row]),
  );

  return bags.map((bag) => {
    if (!bag.outlet_id) return bag;
    const o = byId.get(bag.outlet_id);
    if (!o) return bag;
    return {
      ...bag,
      trust_score:
        typeof o.trust_score === 'number'
          ? o.trust_score
          : o.trust_score != null
            ? Number(o.trust_score)
            : null,
      average_rating:
        typeof o.average_rating === 'number'
          ? o.average_rating
          : o.average_rating != null
            ? Number(o.average_rating)
            : null,
      total_reviews:
        typeof o.total_reviews === 'number'
          ? o.total_reviews
          : o.total_reviews != null
            ? Number(o.total_reviews)
            : null,
      collection_rate_pct:
        typeof o.collection_rate_pct === 'number'
          ? o.collection_rate_pct
          : o.collection_rate_pct != null
            ? Number(o.collection_rate_pct)
            : null,
      complaint_rate_pct:
        typeof o.complaint_rate_pct === 'number'
          ? o.complaint_rate_pct
          : o.complaint_rate_pct != null
            ? Number(o.complaint_rate_pct)
            : null,
      no_show_rate_pct:
        typeof o.no_show_rate_pct === 'number'
          ? o.no_show_rate_pct
          : o.no_show_rate_pct != null
            ? Number(o.no_show_rate_pct)
            : null,
    };
  });
}

function finiteCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapRow(row: Record<string, unknown>): DiscoverBag {
  const outlet = row.outlet as Record<string, unknown> | undefined;
  const retailRaw = row.retail_value_estimate;
  const retail =
    typeof retailRaw === 'number'
      ? retailRaw
      : retailRaw != null
        ? Number(retailRaw)
        : NaN;
  const distanceRaw = row.distance_km;
  const distance =
    typeof distanceRaw === 'number'
      ? distanceRaw
      : distanceRaw != null
        ? Number(distanceRaw)
        : NaN;
  const outletIdRaw =
    row.outlet_id != null
      ? String(row.outlet_id)
      : outlet?.id != null
        ? String(outlet.id)
        : null;

  let outletLat = finiteCoord(row.outlet_lat);
  let outletLng = finiteCoord(row.outlet_lng);
  if (outletLat == null || outletLng == null) {
    const fromGeo = parseOutletCoords(outlet?.location);
    if (fromGeo) {
      outletLat = fromGeo.lat;
      outletLng = fromGeo.lng;
    }
  }

  return {
    id: String(row.id),
    title: String(row.title ?? 'Bag'),
    rescue_price: Number(row.rescue_price ?? 0),
    outlet_id: outletIdRaw,
    outlet_lat: outletLat ?? undefined,
    outlet_lng: outletLng ?? undefined,
    // `nearby_bags` RPC rows are flat (outlet_name column); fallback/supplement
    // paths nest the outlet join. Read both so names survive either shape.
    outlet_name:
      row.outlet_name != null
        ? String(row.outlet_name)
        : outlet?.name != null
          ? String(outlet.name)
          : null,
    landmark:
      row.outlet_landmark != null
        ? String(row.outlet_landmark)
        : row.landmark != null
          ? String(row.landmark)
          : outlet?.landmark != null
            ? String(outlet.landmark)
            : null,
    outlet_landmark:
      row.outlet_landmark != null
        ? String(row.outlet_landmark)
        : outlet?.landmark != null
          ? String(outlet.landmark)
          : null,
    distance_km: Number.isFinite(distance) ? distance : null,
    quantity_remaining:
      typeof row.quantity_remaining === 'number'
        ? row.quantity_remaining
        : null,
    category:
      row.category != null ? String(row.category) : null,
    outlet_category:
      outlet?.category != null ? String(outlet.category) : null,
    image_url:
      row.image_url != null ? String(row.image_url) : null,
    retail_value_estimate: Number.isFinite(retail) ? retail : null,
    pickup_start:
      typeof row.pickup_start === 'string' ? row.pickup_start : null,
    pickup_end: typeof row.pickup_end === 'string' ? row.pickup_end : null,
    pickup_window_kind:
      row.pickup_window_kind != null ? String(row.pickup_window_kind) : null,
    occasion_kind:
      row.occasion_kind != null ? String(row.occasion_kind) : null,
  };
}

async function fetchBagsForOutlets(
  supabase: ReturnType<typeof getSupabase>,
  outletIds: string[],
  includeSoldOut: boolean,
): Promise<DiscoverBag[]> {
  const uniqueIds = [...new Set(outletIds.filter(Boolean))];
  if (!uniqueIds.length) return [];

  let query = supabase
    .from('rescue_bags')
    .select(
      `
          id,
          title,
          category,
          rescue_price,
          retail_value_estimate,
          pickup_start,
          pickup_end,
          pickup_window_kind,
          image_url,
          quantity_remaining,
          outlet_id,
          outlet:outlets (
            id,
            name,
            category,
            landmark,
            location,
            trust_score,
            average_rating,
            total_reviews,
            collection_rate_pct,
            complaint_rate_pct,
            no_show_rate_pct
          )
        `,
    )
    .in('outlet_id', uniqueIds)
    .in('status', ['live', 'draft']);
  if (!includeSoldOut) {
    query = query.gt('quantity_remaining', 0);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logSupabaseError(error, 'useNearbyBags.fetchBagsForOutlets');
    return [];
  }

  return (data ?? []).map((raw) => {
    const mapped = mapRow(raw as Record<string, unknown>);
    const outlet = (raw as Record<string, unknown>).outlet as
      | Record<string, unknown>
      | undefined;
    if (!outlet) return mapped;
    return {
      ...mapped,
      trust_score:
        typeof outlet.trust_score === 'number'
          ? outlet.trust_score
          : outlet.trust_score != null
            ? Number(outlet.trust_score)
            : null,
      average_rating:
        typeof outlet.average_rating === 'number'
          ? outlet.average_rating
          : outlet.average_rating != null
            ? Number(outlet.average_rating)
            : null,
      total_reviews:
        typeof outlet.total_reviews === 'number'
          ? outlet.total_reviews
          : outlet.total_reviews != null
            ? Number(outlet.total_reviews)
            : null,
      collection_rate_pct:
        typeof outlet.collection_rate_pct === 'number'
          ? outlet.collection_rate_pct
          : outlet.collection_rate_pct != null
            ? Number(outlet.collection_rate_pct)
            : null,
      complaint_rate_pct:
        typeof outlet.complaint_rate_pct === 'number'
          ? outlet.complaint_rate_pct
          : outlet.complaint_rate_pct != null
            ? Number(outlet.complaint_rate_pct)
            : null,
      no_show_rate_pct:
        typeof outlet.no_show_rate_pct === 'number'
          ? outlet.no_show_rate_pct
          : outlet.no_show_rate_pct != null
            ? Number(outlet.no_show_rate_pct)
            : null,
    };
  });
}

/**
 * Location-scoped rescue bags for Discover and SearchResults. Includes live bags
 * from hybrid outlets that publish clearance shelves but sit outside the RPC radius
 * (e.g. demo outlets with unset map coordinates).
 */
export async function fetchScopedNearbyBags(
  supabase: ReturnType<typeof getSupabase>,
  lat: number,
  lng: number,
  includeSoldOut = false,
): Promise<DiscoverBag[]> {
  const { data, error: rpcErr } = await supabase.rpc('nearby_bags', {
    user_lat: lat,
    user_lng: lng,
    radius_km: 10,
  });

  if (rpcErr) {
    throw rpcErr;
  }

  let next = (data as Record<string, unknown>[] | null)?.map(mapRow) ?? [];

  if (next.length === 0) {
    let fallbackQuery = supabase
      .from('rescue_bags')
      .select(
        `
          id,
          title,
          category,
          rescue_price,
          retail_value_estimate,
          pickup_start,
          pickup_end,
          pickup_window_kind,
          image_url,
          quantity_remaining,
          occasion_kind,
          outlet:outlets (
            id,
            name,
            category,
            landmark,
            location,
            trust_score,
            average_rating,
            total_reviews,
            collection_rate_pct,
            complaint_rate_pct,
            no_show_rate_pct
          )
        `,
      )
      .in('status', ['live', 'draft']);
    if (!includeSoldOut) {
      fallbackQuery = fallbackQuery.gt('quantity_remaining', 0);
    }
    const { data: fallback, error: fbErr } = await fallbackQuery
      .order('created_at', { ascending: false })
      .limit(24);

    if (fbErr) {
      throw fbErr;
    }

    next = (fallback ?? []).map((raw) => {
      const mapped = mapRow(raw as Record<string, unknown>);
      const outlet = (raw as Record<string, unknown>).outlet as
        | Record<string, unknown>
        | undefined;
      if (!outlet) return mapped;
      return {
        ...mapped,
        trust_score:
          typeof outlet.trust_score === 'number'
            ? outlet.trust_score
            : outlet.trust_score != null
              ? Number(outlet.trust_score)
              : null,
        average_rating:
          typeof outlet.average_rating === 'number'
            ? outlet.average_rating
            : outlet.average_rating != null
              ? Number(outlet.average_rating)
              : null,
        total_reviews:
          typeof outlet.total_reviews === 'number'
            ? outlet.total_reviews
            : outlet.total_reviews != null
              ? Number(outlet.total_reviews)
              : null,
        collection_rate_pct:
          typeof outlet.collection_rate_pct === 'number'
            ? outlet.collection_rate_pct
            : outlet.collection_rate_pct != null
              ? Number(outlet.collection_rate_pct)
              : null,
        complaint_rate_pct:
          typeof outlet.complaint_rate_pct === 'number'
            ? outlet.complaint_rate_pct
            : outlet.complaint_rate_pct != null
              ? Number(outlet.complaint_rate_pct)
              : null,
        no_show_rate_pct:
          typeof outlet.no_show_rate_pct === 'number'
            ? outlet.no_show_rate_pct
            : outlet.no_show_rate_pct != null
              ? Number(outlet.no_show_rate_pct)
              : null,
      };
    });
  } else if (!includeSoldOut) {
    next = next.filter(
      (b) =>
        typeof b.quantity_remaining !== 'number' || b.quantity_remaining > 0,
    );
  }

  const shelfRows = await fetchPublishedShelves(supabase);
  const shelfOutletIds = [
    ...new Set(
      shelfRows
        .map((s) => (s.outlet_id != null ? String(s.outlet_id) : ''))
        .filter(Boolean),
    ),
  ];
  const bagIds = new Set(next.map((b) => b.id));
  const coveredOutletIds = new Set(
    next.map((b) => b.outlet_id).filter(Boolean) as string[],
  );
  const missingShelfOutletIds = shelfOutletIds.filter(
    (id) => !coveredOutletIds.has(id),
  );
  if (missingShelfOutletIds.length > 0) {
    const supplemental = await fetchBagsForOutlets(
      supabase,
      missingShelfOutletIds,
      includeSoldOut,
    );
    for (const bag of supplemental) {
      if (!bagIds.has(bag.id)) {
        next.push(bag);
        bagIds.add(bag.id);
      }
    }
  }

  return enrichBagsWithOutletTrust(
    supabase,
    await enrichBagsWithOutletCoords(supabase, next),
  );
}

/**
 * Discover feed. When `includeSoldOut` is true, the fallback path drops the
 * `.gt('quantity_remaining', 0)` filter so sold-out rows surface with the dimmed
 * card chrome / "Sold out" pill. The Discover "Include sold out" chip drives this.
 */
export function useNearbyBags(
  env: AppEnv,
  lat: number,
  lng: number,
  options?: { includeSoldOut?: boolean },
) {
  const includeSoldOut = options?.includeSoldOut ?? false;
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [bags, setBags] = useState<DiscoverBag[]>([]);
  const [shelves, setShelves] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchScopedNearbyBags(supabase, lat, lng, includeSoldOut);
      setBags(next);
      const shelfRows = await fetchPublishedShelves(supabase);
      setShelves(shelfRows);
    } catch (e) {
      logSupabaseError(e, 'useNearbyBags.fetchNearby');
      setError(mapSupabaseError(e as Error, ERROR.discover.loadBags));
      setBags([]);
      setShelves([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, lat, lng, includeSoldOut]);

  const feedItems = useMemo(
    () =>
      mergeDiscoverFeed(
        bags as unknown as Record<string, unknown>[],
        shelves,
      ),
    [bags, shelves],
  );

  return {
    bags,
    shelves,
    feedItems,
    loading,
    error,
    refetch: fetchNearby,
  };
}
