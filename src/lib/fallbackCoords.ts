/**
 * Static fallback coordinates for the entire app. Used by:
 *  - `useUserLocation` (live-map hook) when permission is pending/denied/unavailable.
 *  - Screens that render a static map raster (OrderDetail) but need a sensible
 *    pin location before the underlying outlet has a real lat/lng.
 *  - Merchant flows (OnboardingScreen step 2, OutletEditor) for the initial
 *    pin position when the merchant hasn't yet dropped a marker.
 *
 * Lives in `@/lib` (not `@/hooks/useUserLocation`) so importers that only need
 * the constant don't pull `@react-native-community/geolocation` into their
 * module graph. If the native module ever fails to link again, only the
 * live-map screen blows up, not every static-map screen.
 *
 * Coordinates: Colombo Fort, Sri Lanka.
 */
export const FALLBACK_COORDS = Object.freeze({
  lat: 6.9271,
  lng: 79.8612,
} as const);

export type FallbackCoords = typeof FALLBACK_COORDS;
