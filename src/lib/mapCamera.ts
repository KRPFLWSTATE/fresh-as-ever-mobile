import { Platform } from 'react-native';
import type { Camera } from 'react-native-maps';

const IOS_MAP_ALTITUDE_MIN_M = 120;
const IOS_MAP_ALTITUDE_MAX_M = 45_000_000;

/**
 * Approximate MapKit camera altitude (m) for a Google-style zoom level.
 * Baseline: zoom 10 ≈ 24 km; each +1 zoom halves altitude.
 */
export function iosMapAltitudeForZoom(zoom: number): number {
  const baseZoom = 10;
  const baseAlt = 24_000;
  const alt = baseAlt * 2 ** (baseZoom - zoom);
  return Math.min(IOS_MAP_ALTITUDE_MAX_M, Math.max(IOS_MAP_ALTITUDE_MIN_M, alt));
}

/** Discover map default — zoom 14 (~1.5 km altitude on iOS). */
export const DISCOVER_MAP_ZOOM = 14;

export function discoverMapAnimateCamera(
  center: { lat: number; lng: number },
  pitch: number,
  zoom = DISCOVER_MAP_ZOOM,
): Partial<Camera> {
  const cam: Partial<Camera> = {
    center: { latitude: center.lat, longitude: center.lng },
    pitch,
  };
  if (Platform.OS === 'ios') {
    cam.altitude = iosMapAltitudeForZoom(zoom);
  } else {
    cam.zoom = zoom;
  }
  return cam;
}
