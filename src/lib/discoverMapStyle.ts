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
 * Water uses the pass15e lagoon teal (`#6ec4cc`) with deep `#004f54` / `#01696f`
 * shorelines — never stock Google `#aadaff` lagoon blue.
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
 * Branded lagoon water — Stitch primaryContainer / pass15e teal, never stock
 * Google `#aadaff`. Placed last in each style array so fill + stroke win over
 * the global geometry rule.
 */
const LIGHT_WATER_FILL = '#2a9098';
const LIGHT_WATER_STROKE = '#004f54';
const DARK_WATER_FILL = '#148890';
const DARK_WATER_STROKE = '#02b3be';

/** Lagoon fill + deep shoreline stroke — `water` is the only embedded-JSON type. */
function brandedWaterStyles(
  fill: string,
  stroke: string,
  labelFill: string,
): MapStyleElement[] {
  return [
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: fill }],
    },
    {
      featureType: 'water',
      elementType: 'geometry.fill',
      stylers: [{ color: fill }, { visibility: 'on' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry.stroke',
      stylers: [{ color: stroke }, { weight: 2.5 }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: labelFill }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [{ color: fill }, { weight: 2 }],
    },
  ];
}

/**
 * Light — "bright rescue lagoon": white/cream land canvas, **saturated brand
 * teal water** (pass15e lagoon, not generic `#aadaff`), vivid park greens,
 * bold road hierarchy, teal-tinted building blocks. Printed/digital.
 */
export const DISCOVER_MAP_STYLE_LIGHT: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#faf9f6' }] },
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
    stylers: [{ color: '#8a9494' }, { weight: 1.4 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#004f54' }, { weight: 2.4 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.6 }],
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
    stylers: [{ color: '#faf9f6' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#faf9f6' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#eef8f6' }],
  },
  {
    featureType: 'landscape.natural.landcover',
    elementType: 'geometry',
    stylers: [{ color: '#b0e4d8' }],
  },
  {
    featureType: 'landscape.natural.terrain',
    elementType: 'geometry',
    stylers: [{ color: '#88d4c8' }],
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
    stylers: [{ color: '#eef4f4' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'geometry',
    stylers: [{ color: '#f0f4f4' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'geometry',
    stylers: [{ color: '#fde8cc' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#52cc88' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#004f54' }, { weight: 2 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'geometry',
    stylers: [{ color: '#48c078' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#d4dede' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#7a8888' }, { weight: 1.4 }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#2d3131' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#ecf0f0' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#a0acac' }, { weight: 1.2 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#5a6868' }, { weight: 1.6 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#181c1d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#e8f4f4' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#004f54' }, { weight: 2 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#004f54' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#d0e8e6' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 2.4 }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#8ce0dc' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#fde8cc' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#c4d8da' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.2 }],
  },
  ...brandedWaterStyles(LIGHT_WATER_FILL, LIGHT_WATER_STROKE, '#d0e8e6'),
];

/**
 * Dark — "night rescue lagoon": glowing brand teal water, saturated forest
 * parks, charcoal road tiers with bright cyan highway accents.
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
    stylers: [{ color: '#6a6660' }, { weight: 1.2 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#85d3da' }, { weight: 2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1.6 }],
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
    stylers: [{ color: '#02b3be' }, { weight: 1.8 }],
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
    stylers: [{ color: '#1a1c1e' }, { weight: 1 }],
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
    stylers: [{ color: '#1a1916' }, { weight: 1 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#424a50' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d30' }, { weight: 1.2 }],
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
    stylers: [{ color: '#01696f' }, { weight: 2 }],
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
    stylers: [{ color: '#02b3be' }, { weight: 2.4 }],
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
    featureType: 'building',
    elementType: 'geometry',
    stylers: [{ color: '#2a2824' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#01696f' }, { weight: 1 }],
  },
  ...brandedWaterStyles(DARK_WATER_FILL, DARK_WATER_STROKE, '#85d3da'),
];

/** Resolve the active Discover surface style for light / dark theme. */
export function discoverMapStyleForScheme(
  scheme: 'light' | 'dark',
): MapStyleElement[] {
  return scheme === 'dark'
    ? DISCOVER_MAP_STYLE_DARK
    : DISCOVER_MAP_STYLE_LIGHT;
}
