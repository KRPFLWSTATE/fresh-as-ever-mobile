import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapStyleElement } from 'react-native-maps';

/**
 * Discover map surface — Fresh As Ever branded Google Maps JSON styles.
 *
 * Rescue Radar markers / controls stay untouched; only the tile surface
 * (land, parks, water, roads, labels, buildings) is restyled here.
 *
 * Apple MapKit ignores `customMapStyle`, so Discover uses `PROVIDER_GOOGLE`
 * on iOS once the Google Maps SDK + API key are configured in the native
 * project (see pass15e verification doc).
 */

/** True when Discover renders Google tiles (both platforms after iOS SDK link). */
export const discoverMapUsesGoogleTiles =
  Platform.OS === 'android' || Platform.OS === 'ios';

/** Map provider for the customer Discover surface only. */
export const discoverMapProvider = discoverMapUsesGoogleTiles
  ? PROVIDER_GOOGLE
  : PROVIDER_DEFAULT;

/** MapView loading chrome — matches parchment / night-rescue surfaces. */
export const DISCOVER_MAP_LOADING_LIGHT = {
  background: '#f4f0e8',
  indicator: '#01696f',
} as const;

export const DISCOVER_MAP_LOADING_DARK = {
  background: '#121110',
  indicator: '#85d3da',
} as const;

export function discoverMapLoadingForScheme(scheme: 'light' | 'dark') {
  return scheme === 'dark'
    ? DISCOVER_MAP_LOADING_DARK
    : DISCOVER_MAP_LOADING_LIGHT;
}

/**
 * Light — "market-day parchment": warm civic paper, layered sage greens,
 * lagoon water, stone road hierarchy, and quiet building massing so typed
 * rescue pins remain the loudest color on the canvas.
 */
export const DISCOVER_MAP_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f4f0e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a4742' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f4f0e8' }, { weight: 3 }] },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#e8e4db' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cfc9be' }, { weight: 0.6 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#b8b2a6' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d4cec4' }, { weight: 0.8 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }, { weight: 0.5 }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b6762' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a847a' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#ebe6dd' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#e6e1d8' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#e4ebe0' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#d8e5d4' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#d0dcc8' }, { lightness: 8 }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#e2ebe0' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5c7a62' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#e8e2dc' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#e4dfd6' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#e6ebe2' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#a8cdb0' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#7aab86' }, { weight: 0.6 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2d5a38' }, { weight: 0.5 }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#b4d4bc' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#e4dfd4' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d2ccc2' }, { weight: 0.4 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5c5852' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#ebe6dd' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d8d2c8' }, { weight: 0.3 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#faf7f0' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d6d0c4' }, { weight: 0.5 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3f4949' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d0c9bc' }, { weight: 0.8 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }, { weight: 0.5 }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#fffdf8' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#b8d4d8' }, { weight: 1 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#c5ddd8' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#d8e4e0' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#5ab8c2' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a9aa6' }, { weight: 0.5 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#01696f' }, { weight: 0.5 }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#ddd8cf' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c4beb4' }, { weight: 0.4 }],
  },
];

/**
 * Dark — "night rescue lagoon": umber civic blocks, forest parks, deep teal
 * water, charcoal road tiers with teal highway glow, and muted building
 * silhouettes so saturated rescue pins stay forward.
 */
export const DISCOVER_MAP_STYLE_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#121110' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#97e6ec' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121110' }, { weight: 3 }] },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#1a1916' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a3832' }, { weight: 0.6 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4a4840' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2e2c28' }, { weight: 0.8 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }, { weight: 0.5 }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7a736b' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5c5852' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#171614' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#1c1b18' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#151412' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#1a2820' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#1e3028' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1a1916' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5a9a82' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#1e1c1a' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#22201c' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#1c221e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#163028' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f4a3c' }, { weight: 0.6 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5a9a82' }, { weight: 0.5 }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#1a3830' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#26282c' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1c1e' }, { weight: 0.4 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b5b2ad' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#222428' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#181a1c' }, { weight: 0.3 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#30363c' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#24282c' }, { weight: 0.5 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c8e8ec' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3a4850' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }, { weight: 0.5 }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#445560' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a5a62' }, { weight: 1.2 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#1a383e' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#1e2e32' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#083c42' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a5a62' }, { weight: 0.5 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4f98a3' }, { weight: 0.5 }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#22201c' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2e2b26' }, { weight: 0.4 }],
  },
];

/** Resolve the active Discover surface style for light / dark theme. */
export function discoverMapStyleForScheme(
  scheme: 'light' | 'dark',
): MapStyleElement[] {
  return scheme === 'dark'
    ? DISCOVER_MAP_STYLE_DARK
    : DISCOVER_MAP_STYLE_LIGHT;
}
