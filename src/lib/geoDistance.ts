export function parseOutletLatLng(
  location: unknown,
): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'object') return null;
  const geo = location as { coordinates?: number[]; lat?: number; lng?: number };
  if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
    const lng = Number(geo.coordinates[0]);
    const lat = Number(geo.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
    return { lat: Number(geo.lat), lng: Number(geo.lng) };
  }
  return null;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceLabel(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}
