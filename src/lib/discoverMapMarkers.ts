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

/** 5 decimals ≈ 1.1 m — group outlets that are effectively co-located. */
function discoverMarkerCoordGroupKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
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
