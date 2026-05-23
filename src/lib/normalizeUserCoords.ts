import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { isRunningInSimulator } from '@/lib/isRunningInSimulator';

/** Rough Sri Lanka service bbox (with a little margin). */
const SL_LAT_MIN = 5.5;
const SL_LAT_MAX = 10.5;
const SL_LNG_MIN = 79.0;
const SL_LNG_MAX = 82.5;

/**
 * Fixes common lat/lng swaps (e.g. Colombo lng ~79 stored as latitude → Arctic view)
 * and rejects coordinates that cannot be a valid user fix for this app.
 */
export function normalizeUserCoords(
  lat: number,
  lng: number,
): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  let a = lat;
  let b = lng;

  // Simulator / cache bug: Sri Lanka longitude (~79–82) stored as latitude.
  if (a > 50 && a < 90 && b > 5 && b < 15) {
    const swappedLat = b;
    const swappedLng = a;
    a = swappedLat;
    b = swappedLng;
  }

  // Production devices: Sri Lanka service bbox only. Simulator GPX (Freeway Drive,
  // City Run) and `simctl location` use global coords — accept any valid fix.
  if (!isRunningInSimulator()) {
    if (a < SL_LAT_MIN || a > SL_LAT_MAX || b < SL_LNG_MIN || b > SL_LNG_MAX) {
      return null;
    }
  }

  return { lat: a, lng: b };
}

export function isPlausibleUserCoords(lat: number, lng: number): boolean {
  return normalizeUserCoords(lat, lng) != null;
}

export function fallbackUserLocation(): {
  lat: number;
  lng: number;
} {
  return { lat: FALLBACK_COORDS.lat, lng: FALLBACK_COORDS.lng };
}
