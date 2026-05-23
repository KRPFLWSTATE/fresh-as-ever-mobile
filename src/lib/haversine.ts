/**
 * Great-circle distance between two WGS84 coordinates, in kilometres.
 *
 * Used by Discover's live-map refresh logic (`useUserLocation` → DiscoverScreen)
 * to decide when the customer has drifted far enough from their last feed center
 * that we should re-query `nearby_bags`. The thresholds are tiered by speed:
 *
 *   walking / stopped (< 2 m/s):  0.5 km
 *   cycling / city traffic  (< 8): 1.0 km
 *   driving (>= 8 m/s):           refresh paused (banner + manual button)
 *
 * Implementation: standard haversine. Earth radius 6371 km. Inputs are degrees.
 * Returns NaN if any argument is non-finite so callers can short-circuit safely.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return NaN;
  }
  const R_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_KM * c;
}
