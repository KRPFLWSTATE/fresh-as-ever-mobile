import React from 'react';
import { Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import type {
  DiscoverMapOutletMarker,
  DiscoverMarkerKind,
} from '@/lib/discoverMapMarkers';

const MARKER_IMAGES: Record<DiscoverMarkerKind, number> = {
  bakery: require('@/assets/discover-markers/bakery.png'),
  cafe: require('@/assets/discover-markers/cafe.png'),
  meals: require('@/assets/discover-markers/meals.png'),
  groceries: require('@/assets/discover-markers/groceries.png'),
  supermarket: require('@/assets/discover-markers/supermarket.png'),
  shelf: require('@/assets/discover-markers/shelf.png'),
  hybrid: require('@/assets/discover-markers/hybrid.png'),
  default: require('@/assets/discover-markers/default.png'),
};

/** Native pin tint when `image` is unavailable (Android fallback). */
const MARKER_PIN_COLORS: Record<DiscoverMarkerKind, string> = {
  bakery: '#DA7101',
  cafe: '#6F4E37',
  meals: '#C62828',
  groceries: '#2E7D32',
  supermarket: '#1565C0',
  shelf: '#01696F',
  hybrid: '#7B1FA2',
  default: '#01696F',
};

export type DiscoverMapMarkerProps = {
  marker: DiscoverMapOutletMarker;
  onPress: () => void;
};

/**
 * Bitmap-backed map pin — avoids custom Marker children that fail to rasterise
 * inside a nested FlatList MapView on iOS MapKit.
 */
export function DiscoverMapMarker({
  marker,
  onPress,
}: DiscoverMapMarkerProps): React.ReactElement {
  return (
    <Marker
      coordinate={marker.coordinate}
      title={marker.outletName}
      description={marker.title}
      image={MARKER_IMAGES[marker.markerKind]}
      {...(Platform.OS === 'android'
        ? { pinColor: MARKER_PIN_COLORS[marker.markerKind] }
        : {})}
      anchor={{ x: 0.5, y: 1 }}
      centerOffset={{ x: 0, y: -2 }}
      onPress={onPress}
      testID={`discover.mapMarker.${marker.markerKey}`}
      zIndex={marker.markerKind === 'hybrid' ? 24 : 16}
      accessibilityLabel={`${marker.outletName}, ${marker.title}`}
    />
  );
}

export function discoverMarkerImageForKind(kind: DiscoverMarkerKind): number {
  return MARKER_IMAGES[kind];
}
