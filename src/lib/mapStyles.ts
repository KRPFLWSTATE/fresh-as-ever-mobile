/**
 * Google Maps customMapStyle JSON for the customer Discover and merchant outlet
 * editor surfaces. Two styles ship: a near-default light style (very small set
 * of POI tweaks so labels don't overcrowd the markers) and the well-known
 * "Aubergine" dark style published by Google as a public sample. The dark
 * variant is the canonical Google example at
 * https://developers.google.com/maps/documentation/get-map-id/samples/dark
 * (Apache-2.0 sample code) — no upstream dependency, the JSON is inlined here.
 *
 * Notes:
 *   - These styles only apply to the Google Maps provider (Android, and iOS when
 *     `PROVIDER_GOOGLE` is set). On iOS with `PROVIDER_DEFAULT` (Apple Maps)
 *     `customMapStyle` is ignored — Apple Maps auto-themes to match the system
 *     appearance, which is fine because flipping the user's `themePreference`
 *     also flips the system-level scheme we expose through `useStitchTheme`.
 *   - We deliberately do NOT hide POI / road labels — buildings + landmarks
 *     are useful navigation cues for someone picking up a rescue bag. The
 *     dark style keeps the POI label icons + text on so the map stays usable
 *     after sundown.
 */

import type { MapStyleElement } from 'react-native-maps';

/**
 * Light style — close to Google's "Standard" but with a slightly warmer water
 * fill so the map blends with the Stitch `background` token instead of
 * fighting it. Otherwise stock.
 */
export const MAP_STYLE_LIGHT: MapStyleElement[] = [
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#dde8ec' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels.icon',
    stylers: [{ saturation: -20 }],
  },
];

/**
 * Dark style — Google "Aubergine" sample (Apache-2.0). Tweaked only to lift
 * the water lightness a touch so the Stitch brand cyan markers stay readable.
 */
export const MAP_STYLE_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64779e' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334e87' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6f9ba5' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3C7680' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6675' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#255763' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b0d5ce' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry.fill',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#3a4762' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d70' }],
  },
];

/**
 * Resolve the appropriate Google Maps style array for the current scheme.
 *
 * Returns `MAP_STYLE_DARK` in dark mode and `undefined` in light mode — i.e.
 * Google Maps falls back to its built-in "Standard" light style when the user
 * is in light theme, and only the Aubergine override is applied when they
 * switch to dark. (`MAP_STYLE_LIGHT` remains exported for callers that
 * deliberately want the warmer-water tweak.) `customMapStyle` is `optional` on
 * `<MapView>`, so passing `undefined` is the documented opt-out.
 */
export function mapStyleForScheme(
  scheme: 'light' | 'dark',
): MapStyleElement[] | undefined {
  return scheme === 'dark' ? MAP_STYLE_DARK : undefined;
}
