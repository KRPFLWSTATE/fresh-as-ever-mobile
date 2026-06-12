import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapStyleElement } from 'react-native-maps';

/**
 * Discover map surface — Fresh As Ever branded Google Maps JSON styles.
 *
 * Palette anchored on Stitch tokens (`stitchColorsLight` / `stitchColorsDark`):
 * background `#f7f6f2`, surface `#ffffff`, primary `#004f54`, primaryContainer
 * `#01696f`, primaryHighlight `#d0e8e6`, accent `#da7101`, accentHighlight
 * `#fde8cc`. Rescue Radar markers / controls stay untouched.
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

/** MapView loading chrome — matches fresh canvas / night-rescue surfaces. */
export const DISCOVER_MAP_LOADING_LIGHT = {
  background: '#ffffff',
  indicator: '#01696f',
} as const;

export const DISCOVER_MAP_LOADING_DARK = {
  background: '#141412',
  indicator: '#02b3be',
} as const;

export function discoverMapLoadingForScheme(scheme: 'light' | 'dark') {
  return scheme === 'dark'
    ? DISCOVER_MAP_LOADING_DARK
    : DISCOVER_MAP_LOADING_LIGHT;
}

/**
 * Light — "bright rescue canvas": high-luminance white/cream land, vivid lagoon
 * water, fresh green parks with crisp edges, bold road hierarchy, dark readable
 * labels. Printed/digital — not pencil-sketch grey wash.
 */
export const DISCOVER_MAP_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#181c1d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3.5 }] },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#f7f6f2' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#6f797a' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#004f54' }, { weight: 2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#bec8c9' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2d3131' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4742' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#f0faf8' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#b8e8de' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#98d8cc' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f7f6f2' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#01696f' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#f1f4f4' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#f7f6f2' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#fde8cc' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#6dd4a0' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.6 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#58c890' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#dce4e4' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#8a9999' }, { weight: 1.2 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2d3131' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#eef2f2' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a8b4b4' }, { weight: 1 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#6f797a' }, { weight: 1.4 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#181c1d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#004f54' }, { weight: 1.6 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 2 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#a8e8e4' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#fde8cc' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#72dce4' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.4 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#d0e0e0' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#7a9496' }, { weight: 1 }],
  },
];

/**
 * Dark — "night rescue lagoon": vivid teal water glow, saturated forest parks,
 * charcoal road tiers with bright cyan highway accents — not pencil-grey wash.
 */
export const DISCOVER_MAP_STYLE_DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#141412' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a8f0f4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141412' }, { weight: 2.5 }] },
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
    stylers: [{ color: '#6a6660' }, { weight: 1 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#85d3da' }, { weight: 1.6 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#45423e' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a8f0f4' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d8ecec' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9a948c' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#1c1b18' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#252420' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#141a18' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#245848' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#286858' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1c1b18' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#252420' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#2a2824' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#3a3028' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#348868' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#02b3be' }, { weight: 1.4 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#286858' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#343a3e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1c1e' }, { weight: 0.8 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d8ecec' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#252420' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1916' }, { weight: 0.8 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#424a50' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d30' }, { weight: 1 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e8f8f8' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#526068' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.6 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#586870' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#02b3be' }, { weight: 2 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#1a5858' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#5a4028' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#128890' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#02b3be' }, { weight: 1.4 }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#85d3da' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#2a2824' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#6a6660' }, { weight: 0.8 }],
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
