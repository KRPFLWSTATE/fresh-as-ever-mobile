import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { AppEnv } from '@/config/env';
import { LocationSearchField } from '@/components/LocationSearchField';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { fetchLocationReverse, type LocationHit } from '@/lib/locationApi';
import { discoverMapAnimateCamera } from '@/lib/mapCamera';
import { mapStyleForScheme } from '@/lib/mapStyles';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchButton, StitchIcon, StitchText } from '@/ui/stitch';

export type OutletLocationPickerProps = {
  env: AppEnv;
  address: string;
  lat: number | null;
  lng: number | null;
  onAddressChange: (address: string) => void;
  onCoordsChange: (lat: number, lng: number) => void;
  /** Overlay search on map (onboarding) vs stacked above map (editor). */
  variant?: 'stacked' | 'map-overlay';
  /** Show address field (false when parent renders address elsewhere). */
  showAddressField?: boolean;
};

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatCoord(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/**
 * Merchant outlet location UX — address search, GPS, draggable map pin, collapsed lat/lng.
 */
export function OutletLocationPicker({
  env,
  address,
  lat,
  lng,
  onAddressChange,
  onCoordsChange,
  variant = 'stacked',
  showAddressField = true,
}: OutletLocationPickerProps): React.ReactElement {
  const { colors, radii, spacing, colorScheme } = useStitchTheme();
  const mapRef = useRef<MapView>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [latText, setLatText] = useState(lat != null ? formatCoord(lat) : '');
  const [lngText, setLngText] = useState(lng != null ? formatCoord(lng) : '');

  useEffect(() => {
    if (lat != null && Number.isFinite(lat)) setLatText(formatCoord(lat));
  }, [lat]);

  useEffect(() => {
    if (lng != null && Number.isFinite(lng)) setLngText(formatCoord(lng));
  }, [lng]);

  const hasCoords = lat != null && lng != null && isValidCoord(lat, lng);
  const mapLat = hasCoords ? lat : FALLBACK_COORDS.lat;
  const mapLng = hasCoords ? lng : FALLBACK_COORDS.lng;

  const customMapStyle = useMemo(() => mapStyleForScheme(colorScheme), [colorScheme]);

  const mapRegion = useMemo(
    () => ({
      latitude: mapLat,
      longitude: mapLng,
      latitudeDelta: variant === 'map-overlay' ? 0.02 : 0.05,
      longitudeDelta: variant === 'map-overlay' ? 0.02 : 0.05,
    }),
    [mapLat, mapLng, variant],
  );

  const mapRegionKey = hasCoords
    ? `${mapLat.toFixed(5)}:${mapLng.toFixed(5)}`
    : 'fallback';

  const animateTo = useCallback((nextLat: number, nextLng: number) => {
    mapRef.current?.animateCamera(
      discoverMapAnimateCamera({ lat: nextLat, lng: nextLng }, 0, 14),
      { duration: 450 },
    );
  }, []);

  const reverseGeocode = useCallback(
    async (nextLat: number, nextLng: number) => {
      setReverseBusy(true);
      try {
        const label = await fetchLocationReverse(env, nextLat, nextLng);
        if (label) onAddressChange(label);
      } finally {
        setReverseBusy(false);
      }
    },
    [env, onAddressChange],
  );

  const applyCoords = useCallback(
    (nextLat: number, nextLng: number, opts?: { reverse?: boolean; animate?: boolean }) => {
      if (!isValidCoord(nextLat, nextLng)) return;
      onCoordsChange(nextLat, nextLng);
      setLatText(formatCoord(nextLat));
      setLngText(formatCoord(nextLng));
      if (opts?.animate !== false) animateTo(nextLat, nextLng);
      if (opts?.reverse) void reverseGeocode(nextLat, nextLng);
    },
    [animateTo, onCoordsChange, reverseGeocode],
  );

  const handleSelectHit = useCallback(
    (hit: LocationHit) => {
      setSearchEnabled(false);
      onAddressChange(hit.label);
      applyCoords(hit.lat, hit.lng, { reverse: false });
      setTimeout(() => setSearchEnabled(true), 300);
    },
    [applyCoords, onAddressChange],
  );

  const handleCoordsFromText = useCallback(
    (coords: { lat: number; lng: number }) => {
      applyCoords(coords.lat, coords.lng, { reverse: false });
    },
    [applyCoords],
  );

  const detectCurrentLocation = useCallback(() => {
    setGpsBusy(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        applyCoords(latitude, longitude, { reverse: true });
        setGpsBusy(false);
      },
      () => {
        setGpsBusy(false);
        Alert.alert(
          'Location unavailable',
          'Enable location services or search for your outlet address instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
  }, [applyCoords]);

  const handleDragEnd = useCallback(
    (nextLat: number, nextLng: number) => {
      applyCoords(nextLat, nextLng, { reverse: true });
    },
    [applyCoords],
  );

  const commitAdvancedLat = useCallback(() => {
    const parsed = Number(latText);
    const baseLng = lng ?? Number(lngText) ?? FALLBACK_COORDS.lng;
    if (!Number.isFinite(parsed) || !Number.isFinite(baseLng)) return;
    applyCoords(parsed, baseLng, { reverse: false, animate: true });
  }, [applyCoords, latText, lng, lngText]);

  const commitAdvancedLng = useCallback(() => {
    const parsed = Number(lngText);
    const baseLat = lat ?? Number(latText) ?? FALLBACK_COORDS.lat;
    if (!Number.isFinite(parsed) || !Number.isFinite(baseLat)) return;
    applyCoords(baseLat, parsed, { reverse: false, animate: true });
  }, [applyCoords, lat, latText, lngText]);

  const styles = useMemo(() => createStyles({ colors, radii, spacing }), [colors, radii, spacing]);

  const addressSearch = showAddressField ? (
    <LocationSearchField
      env={env}
      value={address}
      onChangeText={onAddressChange}
      onSelectHit={handleSelectHit}
      onCoordsFromText={handleCoordsFromText}
      searchEnabled={searchEnabled}
      placeholder="Street, neighbourhood, city"
      multiline={variant === 'stacked'}
      shellStyle={variant === 'map-overlay' ? styles.overlaySearchShell : undefined}
      inputStyle={variant === 'map-overlay' ? styles.overlaySearchInput : undefined}
    />
  ) : null;

  return (
    <View style={{ gap: spacing.md }}>
      {variant === 'stacked' && addressSearch}

      <View style={styles.gpsRow}>
        <StitchButton
          testID="outlet.location.useGps"
          title={gpsBusy ? 'Detecting…' : 'Use current location'}
          variant="secondary"
          onPress={detectCurrentLocation}
          disabled={gpsBusy}
          style={{ flex: 1 }}
        />
        {reverseBusy ? (
          <ActivityIndicator size="small" color={colors.primaryContainer} />
        ) : null}
      </View>

      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          key={mapRegionKey}
          testID="outlet.location.map"
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          initialRegion={mapRegion}
          region={mapRegion}
          customMapStyle={customMapStyle}
          userInterfaceStyle={colorScheme}
          showsBuildings
          scrollEnabled
          zoomEnabled
        >
          <Marker
            coordinate={{ latitude: mapLat, longitude: mapLng }}
            draggable
            onDragEnd={(e) => {
              const c = e.nativeEvent.coordinate;
              handleDragEnd(c.latitude, c.longitude);
            }}
          />
        </MapView>
        {variant === 'map-overlay' && addressSearch ? (
          <View style={styles.mapOverlaySearch}>{addressSearch}</View>
        ) : null}
      </View>

      <Pressable
        testID="outlet.location.advancedToggle"
        accessibilityRole="button"
        onPress={() => setAdvancedOpen((o) => !o)}
        style={styles.advancedToggle}
      >
        <StitchIcon
          name={advancedOpen ? 'expand_less' : 'expand_more'}
          size={20}
          colorKey="textMuted"
        />
        <StitchText variant="label" colorKey="textMuted">
          Advanced: latitude / longitude
        </StitchText>
      </Pressable>

      {advancedOpen ? (
        <View style={styles.latLngRow}>
          <View style={[styles.fieldCol, { flex: 1 }]}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Latitude
            </StitchText>
            <TextInput
              testID="outlet.location.lat"
              value={latText}
              onChangeText={setLatText}
              onBlur={commitAdvancedLat}
              style={styles.input}
              placeholder={String(FALLBACK_COORDS.lat)}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.fieldCol, { flex: 1 }]}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Longitude
            </StitchText>
            <TextInput
              testID="outlet.location.lng"
              value={lngText}
              onChangeText={setLngText}
              onBlur={commitAdvancedLng}
              style={styles.input}
              placeholder={String(FALLBACK_COORDS.lng)}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(props: {
  colors: ReturnType<typeof useStitchTheme>['colors'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
}) {
  const { colors, radii, spacing } = props;
  const inputBase: TextStyle = {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 15,
  };
  return StyleSheet.create({
    gpsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mapShell: {
      height: 220,
      width: '100%',
      minWidth: 280,
      alignSelf: 'stretch',
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    mapOverlaySearch: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
    },
    overlaySearchShell: {
      backgroundColor: `${colors.surface}e6`,
    } as ViewStyle,
    overlaySearchInput: {
      minHeight: 44,
    },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    latLngRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    fieldCol: { gap: spacing.xs },
    input: inputBase,
  });
}
