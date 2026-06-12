const WKB_POINT_TYPE = 1;
const WKB_SRID_FLAG = 0x20000000;

/**
 * Decode a PostGIS EWKB/WKB hex string for a Point (e.g.
 * `0101000020E610000008AC1C5A64F75340D49AE61DA7A81B40`). PostgREST returns
 * `geography(Point)` columns in this raw hex form unless the query casts to
 * GeoJSON — which the Discover feed selects do not. Without this branch every
 * outlet coordinate parsed to null and the map rendered zero markers.
 */
function parseWkbHexPoint(hex: string): { lat: number; lng: number } | null {
  // 1 byte order + 4 type (+4 srid) + 8 X + 8 Y → at least 42 hex chars.
  if (hex.length < 42 || hex.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  if (bytes[0] !== 0 && bytes[0] !== 1) return null;

  const rawType = view.getUint32(1, littleEndian);
  // Mask EWKB dimension/SRID flags (top nibble); ISO WKB encodes Z/M as +1000/+2000.
  const baseType = (rawType & 0x0fffffff) % 1000;
  if (baseType !== WKB_POINT_TYPE) return null;

  // X/Y always lead the coordinate block; Z/M (if any) follow and are ignored.
  let offset = 5;
  if ((rawType & WKB_SRID_FLAG) !== 0) offset += 4;
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Parse a PostGIS `geography(Point)` join column into `{ lat, lng }`. PostgREST
 * may return GeoJSON (`{ type: 'Point', coordinates: [lng, lat] }`), WKT
 * (`POINT(lng lat)`), or raw EWKB hex (`0101000020E61...`) depending on the
 * select shape. Some rows use `{ longitude, latitude }` or stringly-typed
 * coordinates.
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
    return parseWkbHexPoint(wkt);
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
