import { haversineKm } from '@/lib/haversine';

export type NeighbourhoodFeedItem = {
  outlet_name?: string | null;
  landmark?: string | null;
  outlet_landmark?: string | null;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  distance_km?: number | null;
};

export function readItemLandmark(item: NeighbourhoodFeedItem): string | null {
  const raw = item.landmark ?? item.outlet_landmark;
  const trimmed = String(raw ?? '').trim();
  return trimmed || null;
}

/** Distinct non-empty landmarks from a feed, sorted alphabetically. */
export function distinctLandmarks(items: NeighbourhoodFeedItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const lm = readItemLandmark(item);
    if (lm) set.add(lm);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Multi-select neighbourhood filter — empty selection means no filter. */
export function filterByLandmarks<T extends NeighbourhoodFeedItem>(
  items: T[],
  selected: readonly string[],
): T[] {
  if (!selected.length) return items;
  const wanted = new Set(selected.map((s) => s.trim()).filter(Boolean));
  if (!wanted.size) return items;
  return items.filter((item) => {
    const lm = readItemLandmark(item);
    return lm != null && wanted.has(lm);
  });
}

export type DistanceFilterKey = 'any' | 'near' | 'wide';

function readDistanceKm(
  item: NeighbourhoodFeedItem,
  originLat?: number | null,
  originLng?: number | null,
): number | null {
  if (typeof item.distance_km === 'number' && Number.isFinite(item.distance_km)) {
    return item.distance_km;
  }
  if (
    originLat != null &&
    originLng != null &&
    item.outlet_lat != null &&
    item.outlet_lng != null
  ) {
    const km = haversineKm(originLat, originLng, item.outlet_lat, item.outlet_lng);
    return Number.isFinite(km) ? km : null;
  }
  return null;
}

/** Client-side distance chip — haversine fallback when RPC distance is absent. */
export function filterByDistance<T extends NeighbourhoodFeedItem>(
  items: T[],
  chip: DistanceFilterKey,
  originLat?: number | null,
  originLng?: number | null,
): T[] {
  if (chip === 'any') return items;
  return items.filter((item) => matchesDistanceFilter(item, chip, originLat, originLng));
}

export function matchesDistanceFilter(
  item: NeighbourhoodFeedItem,
  chip: DistanceFilterKey,
  originLat?: number | null,
  originLng?: number | null,
): boolean {
  if (chip === 'any') return true;
  const maxKm = chip === 'near' ? 3 : 10;
  const km = readDistanceKm(item, originLat, originLng);
  if (km == null) return chip === 'wide';
  return km <= maxKm;
}

/** @deprecated alias */
export const extractDistinctLandmarks = distinctLandmarks;

/** @deprecated alias */
export const filterItemsByLandmarks = filterByLandmarks;
