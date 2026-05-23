import { useCallback, useMemo, useState } from 'react';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
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
  /**
   * Distance from the user's current location to the outlet, in kilometres. Returned by
   * the `nearby_bags` RPC. Null on the fallback path (no client geolocation yet).
   */
  distance_km?: number | null;
  quantity_remaining?: number | null;
  category?: string | null;
  image_url?: string | null;
  retail_value_estimate?: number | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
};

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
    outlet_name: outlet?.name != null ? String(outlet.name) : null,
    distance_km: Number.isFinite(distance) ? distance : null,
    quantity_remaining:
      typeof row.quantity_remaining === 'number'
        ? row.quantity_remaining
        : null,
    category:
      row.category != null ? String(row.category) : null,
    image_url:
      row.image_url != null ? String(row.image_url) : null,
    retail_value_estimate: Number.isFinite(retail) ? retail : null,
    pickup_start:
      typeof row.pickup_start === 'string' ? row.pickup_start : null,
    pickup_end: typeof row.pickup_end === 'string' ? row.pickup_end : null,
  };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
          image_url,
          quantity_remaining,
          outlet:outlets ( id, name, location )
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

        next = (fallback ?? []).map((raw) => mapRow(raw as Record<string, unknown>));
      } else if (!includeSoldOut) {
        next = next.filter(
          (b) =>
            typeof b.quantity_remaining !== 'number' || b.quantity_remaining > 0,
        );
      }

      setBags(next);
    } catch (e) {
      logSupabaseError(e, 'useNearbyBags.fetchNearby');
      setError(mapSupabaseError(e as Error, ERROR.discover.loadBags));
      setBags([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, lat, lng, includeSoldOut]);

  return {
    bags,
    loading,
    error,
    refetch: fetchNearby,
  };
}
