import type { DiscoverMarkerKind } from '@/lib/discoverMapMarkers';
import type { StitchIconName } from '@/ui/stitch/iconMap';

/**
 * Visual identity for each Discover map pin kind. Anchored on the Fresh As
 * Ever brand pair — deep teal (#01696F) and rescue amber (#DA7101) — with
 * one saturated, food-true hue per outlet type so a glance at the map reads
 * as "what kind of rescue is that" before any label appears.
 */
export type DiscoverMarkerVisual = {
  /** Pin head fill. */
  fill: string;
  /** Darker companion tone — tail + selected ring. */
  deep: string;
  icon: StitchIconName;
  /** Short human label used by the preview card + accessibility. */
  label: string;
};

export const DISCOVER_MARKER_VISUALS: Record<
  DiscoverMarkerKind,
  DiscoverMarkerVisual
> = {
  bakery: {
    fill: '#C66A00',
    deep: '#8A4A00',
    icon: 'bakery_dining',
    label: 'Bakery rescue',
  },
  cafe: {
    fill: '#6F4E37',
    deep: '#4D3526',
    icon: 'local_cafe',
    label: 'Cafe rescue',
  },
  meals: {
    fill: '#BE4B33',
    deep: '#8C3322',
    icon: 'lunch_dining',
    label: 'Meal rescue',
  },
  groceries: {
    fill: '#3E7D32',
    deep: '#2A5722',
    icon: 'local_grocery_store',
    label: 'Grocery rescue',
  },
  supermarket: {
    fill: '#2D5DA8',
    deep: '#1E4179',
    icon: 'shopping_bag',
    label: 'Supermarket rescue',
  },
  shelf: {
    fill: '#01696F',
    deep: '#004F54',
    icon: 'local_offer',
    label: 'Clearance shelf',
  },
  hybrid: {
    fill: '#5B2E91',
    deep: '#411F6B',
    icon: 'storefront',
    label: 'Bags + shelf',
  },
  default: {
    fill: '#004F54',
    deep: '#002F33',
    icon: 'restaurant',
    label: 'Rescue spot',
  },
};

/** Rescue amber — low-stock badge + selected accents. Matches `colors.accent`. */
export const DISCOVER_MAP_ACCENT = '#DA7101';

/** Markers flag urgency at or below this remaining-bag count. */
export const DISCOVER_LOW_STOCK_THRESHOLD = 3;
