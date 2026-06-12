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
  background: '#f0ebe3',
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
 * Light — "fresh rescue canvas": warm civic parchment with saturated sage
 * parks, lagoon teal water, and a stone road hierarchy. Layered land-use
 * tiers stay separated by hue (not a flat beige wash) so typed rescue pins
 * remain the loudest accent on the canvas.
 */
export const DISCOVER_MAP_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#f0ebe3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3a3834' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f0ebe3' }, { weight: 2.5 }] },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#e4dfd4' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#b8b0a4' }, { weight: 0.8 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#9a9286' }, { weight: 1.4 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c4bcb0' }, { weight: 1 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#003d42' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4540' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6a645c' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#e8e3d8' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#ded8ce' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#d8e6d0' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#c0d8b8' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#b0ccb0' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#dce8d4' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3e6b48' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#e0dbd2' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#dcd6cc' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#d8e4d8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#b8d8be' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#6a9e74' }, { weight: 1 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2d5a38' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#a8d0b0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#e0dbd0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#b8b0a4' }, { weight: 0.6 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4640' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#e8e3da' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c4bcb0' }, { weight: 0.6 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#faf6ee' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a8a094' }, { weight: 0.8 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3a3834' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a8a094' }, { weight: 1 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#003d42' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#fffdf8' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#5ab0bc' }, { weight: 1.2 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#b8d8d4' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#ccdcd8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#64c8d2' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a98a8' }, { weight: 0.8 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#01696f' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#d0cac0' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a8a094' }, { weight: 0.6 }],
  },
];

/**
 * Dark — "night rescue lagoon": umber civic blocks, forest parks, deep teal
 * water, charcoal road tiers with teal highway glow, and muted building
 * silhouettes so saturated rescue pins stay forward.
 */
export const DISCOVER_MAP_STYLE_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#121110' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a8e8ec' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121110' }, { weight: 2.5 }] },
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
    stylers: [{ color: '#4a4840' }, { weight: 0.8 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#5c5a52' }, { weight: 1.4 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a3832' }, { weight: 1 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#97e6ec' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9a948c' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7a746c' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#171614' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#1e1c18' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#141a16' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#1a3028' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#1e3830' }],
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
    stylers: [{ color: '#6ab892' }],
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
    stylers: [{ color: '#1a382e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a5848' }, { weight: 1 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6ab892' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#1e4038' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2a2e32' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1c1e' }, { weight: 0.6 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c8c4be' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#262a2e' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1c1e' }, { weight: 0.5 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#3a4248' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2e32' }, { weight: 0.8 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d8ecec' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#4a5a64' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.2 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#97e6ec' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#526470' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a6870' }, { weight: 1.4 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#1a4048' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#1e3438' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a4a50' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0d6870' }, { weight: 0.8 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5aa8b4' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#22201c' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a3630' }, { weight: 0.6 }],
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
