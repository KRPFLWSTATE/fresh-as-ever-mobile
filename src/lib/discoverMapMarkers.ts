/** Used by tests + Discover list/map to guard duplicate IDs (§ ux-maps-marker-id-collision-ant). */
export function assertUniqueNearbyBagIds(
  bags: { id: unknown }[],
  label = 'bags',
): void {
  const ids = bags.map((b) => String(b.id ?? ''));
  const set = new Set(ids);
  if (set.size !== ids.length) {
    throw new Error(`Duplicate ${label} id in Discover feed`);
  }
}

const EARTH_METRES_PER_DEG_LAT = 111_320;

/** Reject unset PostGIS defaults and non-finite values. */
export function isValidDiscoverOutletCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return false;
  return true;
}

/** 5 decimals ≈ 1.1 m — group outlets that are effectively co-located. */
function discoverMarkerCoordGroupKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export type DiscoverFeedMarkerSource = {
  kind: 'bag' | 'shelf';
  id: string;
  title?: string | null;
  outlet_id?: string | null;
  outlet_name?: string | null;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  category?: string | null;
  outlet_category?: string | null;
};

export type DiscoverMarkerKind =
  | 'bakery'
  | 'cafe'
  | 'meals'
  | 'groceries'
  | 'supermarket'
  | 'shelf'
  | 'hybrid'
  | 'default';

export type DiscoverMapOutletMarker = {
  markerKey: string;
  outletId: string | null;
  outletName: string;
  lat: number;
  lng: number;
  category: string | null;
  markerKind: DiscoverMarkerKind;
  feedKind: 'bag' | 'shelf';
  feedItemId: string;
  title: string;
  coordinate: { latitude: number; longitude: number };
};

const MARKER_KIND_PRIORITY: Record<DiscoverMarkerKind, number> = {
  hybrid: 100,
  shelf: 90,
  bakery: 80,
  cafe: 70,
  meals: 60,
  groceries: 50,
  supermarket: 40,
  default: 0,
};

function markerCategory(item: DiscoverFeedMarkerSource): string | null {
  if (item.kind === 'shelf') {
    return item.category ?? null;
  }
  return item.category ?? item.outlet_category ?? null;
}

function markerTitle(item: DiscoverFeedMarkerSource): string {
  if (item.kind === 'shelf') {
    return "Today's clearance shelf";
  }
  const t = item.title?.trim();
  return t && t.length > 0 ? t : 'Rescue bag';
}

function markerOutletKey(item: DiscoverFeedMarkerSource, lat: number, lng: number): string {
  const outletId = item.outlet_id?.trim();
  if (outletId) return outletId;
  return discoverMarkerCoordGroupKey(lat, lng);
}

/** Map a feed row to a typed pin kind (before outlet-level merge). */
export function resolveDiscoverMarkerKindFromItem(
  item: DiscoverFeedMarkerSource,
): DiscoverMarkerKind {
  if (item.kind === 'shelf') {
    const c = String(item.category ?? '').toLowerCase();
    if (c.includes('super')) return 'supermarket';
    if (
      c.includes('groc') ||
      c.includes('hybrid') ||
      c.includes('veg') ||
      c.includes('produce')
    ) {
      return 'groceries';
    }
    return 'shelf';
  }

  const c = String(item.category ?? item.outlet_category ?? '').toLowerCase();
  if (c.includes('bake') || c.includes('pastry') || c === 'bakery') return 'bakery';
  if (c.includes('cafe') || c.includes('coffee')) return 'cafe';
  if (
    c.includes('meal') ||
    c.includes('lunch') ||
    c.includes('dinner') ||
    c.includes('food') ||
    c.includes('restaurant') ||
    c.includes('mixed')
  ) {
    return 'meals';
  }
  if (c.includes('super')) return 'supermarket';
  if (
    c.includes('groc') ||
    c.includes('hybrid') ||
    c.includes('veg') ||
    c.includes('produce')
  ) {
    return 'groceries';
  }
  return 'default';
}

/** Prefer hybrid when an outlet publishes both bags and shelves; else highest-priority kind. */
export function mergeDiscoverMarkerKinds(
  kinds: readonly DiscoverMarkerKind[],
  hasBag: boolean,
  hasShelf: boolean,
): DiscoverMarkerKind {
  if (hasBag && hasShelf) return 'hybrid';
  let best: DiscoverMarkerKind = 'default';
  let bestScore = -1;
  for (const kind of kinds) {
    const score = MARKER_KIND_PRIORITY[kind] ?? 0;
    if (score > bestScore) {
      best = kind;
      bestScore = score;
    }
  }
  return best;
}

function pickPrimaryFeedItem(
  items: readonly DiscoverFeedMarkerSource[],
  markerKind: DiscoverMarkerKind,
): DiscoverFeedMarkerSource {
  if (markerKind === 'hybrid') {
    return items.find((i) => i.kind === 'bag') ?? items[0]!;
  }
  const kindMatch = items.find(
    (i) => resolveDiscoverMarkerKindFromItem(i) === markerKind,
  );
  if (kindMatch) return kindMatch;
  return items.find((i) => i.kind === 'bag') ?? items[0]!;
}

/**
 * Build one map pin per outlet from the same filtered Discover feed list. Skips
 * invalid coordinates (including POINT(0 0)) with an optional dev-only callback.
 */
export function buildDiscoverMapMarkersFromFeed(
  feedItems: readonly DiscoverFeedMarkerSource[],
  options?: {
    demo?: boolean;
    onSkipInvalid?: (
      item: DiscoverFeedMarkerSource,
      reason: 'missing-coords' | 'invalid-coords',
    ) => void;
  },
): DiscoverMapOutletMarker[] {
  const demo = options?.demo ?? false;
  const buckets = new Map<
    string,
    { lat: number; lng: number; items: DiscoverFeedMarkerSource[] }
  >();

  for (const item of feedItems) {
    const lat = item.outlet_lat;
    const lng = item.outlet_lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      options?.onSkipInvalid?.(item, 'missing-coords');
      continue;
    }
    if (!isValidDiscoverOutletCoord(lat, lng)) {
      options?.onSkipInvalid?.(item, 'invalid-coords');
      continue;
    }

    const key = markerOutletKey(item, lat, lng);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      buckets.set(key, { lat, lng, items: [item] });
    }
  }

  const draft: DiscoverMapOutletMarker[] = [];
  for (const [key, bucket] of buckets) {
    const { lat, lng, items } = bucket;
    const hasBag = items.some((i) => i.kind === 'bag');
    const hasShelf = items.some((i) => i.kind === 'shelf');
    const markerKind = mergeDiscoverMarkerKinds(
      items.map(resolveDiscoverMarkerKindFromItem),
      hasBag,
      hasShelf,
    );
    const primary = pickPrimaryFeedItem(items, markerKind);
    draft.push({
      markerKey: key,
      outletId: primary.outlet_id?.trim() ? String(primary.outlet_id) : null,
      outletName: primary.outlet_name?.trim() || 'Local partner',
      lat,
      lng,
      category: markerCategory(primary),
      markerKind,
      feedKind: primary.kind,
      feedItemId: primary.id,
      title: markerTitle(primary),
      coordinate: { latitude: lat, longitude: lng },
    });
  }

  if (draft.length === 0) return draft;

  const coordInputs = draft.map((m) => ({
    id: m.markerKey,
    outlet_lat: m.lat,
    outlet_lng: m.lng,
  }));

  return draft.map((m) => ({
    ...m,
    coordinate: getDiscoverMarkerCoordinate(
      { id: m.markerKey, outlet_lat: m.lat, outlet_lng: m.lng },
      coordInputs,
      demo,
    ),
  }));
}

/** Count feed rows that carry plottable outlet coordinates (before outlet dedupe). */
export function countFeedItemsWithValidMapCoords(
  feedItems: readonly DiscoverFeedMarkerSource[],
): number {
  return feedItems.filter((item) => {
    const lat = item.outlet_lat;
    const lng = item.outlet_lng;
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      isValidDiscoverOutletCoord(lat, lng)
    );
  }).length;
}

/**
 * When multiple bags share the same outlet coordinates (common in demo / seed
 * data), native markers stack on one pixel. Demo mode nudges each pin a few
 * metres apart in a small ring so every bag stays tappable and visible.
 *
 * Production: returns coordinates unchanged (no geographic lie).
 */
export function getDiscoverMarkerCoordinate(
  bag: { id: string; outlet_lat: number; outlet_lng: number },
  allMappedBags: readonly { id: string; outlet_lat: number; outlet_lng: number }[],
  demo: boolean,
): { latitude: number; longitude: number } {
  const k = discoverMarkerCoordGroupKey(bag.outlet_lat, bag.outlet_lng);
  const cluster = allMappedBags.filter(
    (b) => discoverMarkerCoordGroupKey(b.outlet_lat, b.outlet_lng) === k,
  );
  const idx = Math.max(
    0,
    cluster.findIndex((b) => b.id === bag.id),
  );
  const lat = bag.outlet_lat;
  const lng = bag.outlet_lng;
  if (!demo || cluster.length <= 1) {
    return { latitude: lat, longitude: lng };
  }
  const radiusM = 22;
  const angle = (2 * Math.PI * idx) / cluster.length;
  const dNorth = radiusM * Math.cos(angle);
  const dEast = radiusM * Math.sin(angle);
  const dLat = dNorth / EARTH_METRES_PER_DEG_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng =
    cosLat > 0.01 ? dEast / (EARTH_METRES_PER_DEG_LAT * cosLat) : 0;
  return { latitude: lat + dLat, longitude: lng + dLng };
}
