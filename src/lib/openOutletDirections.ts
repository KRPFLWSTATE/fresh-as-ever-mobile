import { Linking, Platform } from 'react-native';

export type OutletDirectionsInput = {
  name?: string | null;
  address?: string | null;
  landmark?: string | null;
};

/**
 * Opens the platform maps app for an outlet address (same intent as OrderDetail / OutletDetail).
 */
export function openOutletDirections(outlet: OutletDirectionsInput): void {
  const q = encodeURIComponent(
    [outlet.address, outlet.landmark].filter(Boolean).join(', ') ||
      outlet.name ||
      'Fresh As Ever',
  );
  const url = Platform.select({
    ios: `maps:0,0?q=${q}`,
    android: `geo:0,0?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  if (url) {
    void Linking.openURL(url);
  }
}
