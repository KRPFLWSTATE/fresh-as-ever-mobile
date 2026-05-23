/**
 * Parse a PostGIS `geography(Point)` join column into `{ lat, lng }`. PostgREST
 * typically returns GeoJSON (`{ type: 'Point', coordinates: [lng, lat] }`).
 * Some rows use `{ longitude, latitude }` or stringly-typed coordinates.
 */
export function parseOutletCoords(
  raw: unknown,
): { lat: number; lng: number } | null {
  if (typeof raw === 'string') {
    const wkt = raw.trim();
    const point = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (point) {
      const lng = Number(point[1]);
      const lat = Number(point[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const coords = obj.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  const lat = Number(obj.latitude ?? obj.lat);
  const lng = Number(obj.longitude ?? obj.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}
