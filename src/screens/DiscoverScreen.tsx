import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import type { Camera, MapType, Region } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { mapStyleForScheme } from '@/lib/mapStyles';

import {
  RouteProp,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  CustomerTabParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useNearbyBags, type DiscoverBag } from '@/hooks/useNearbyBags';
import type { DiscoverFeedItem } from '@/lib/discoverFeed';
import {
  discoverCategoryMatchesChip,
  type DiscoverCategoryChipId,
} from '@/lib/discoverCategoryChip';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { useUserLocation } from '@/hooks/useUserLocation';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { haversineKm } from '@/lib/haversine';
import { scheduleMicrotask } from '@/lib/microtask';
import {
  fetchLocationSearch,
  fetchLocationReverse,
  type LocationHit,
} from '@/lib/locationApi';
import { isRunningInSimulator } from '@/lib/isRunningInSimulator';
import { isPlausibleUserCoords } from '@/lib/normalizeUserCoords';
import {
  DISCOVER_EMPTY_COPY,
  parseDiscoverState,
} from '@/lib/discoverForcedState';
import {
  resolveDiscoverListEmptyCopy,
  shouldShowDiscoverGuestSignIn,
} from '@/lib/discoverGuestEmptyState';
import {
  assertUniqueNearbyBagIds,
  buildDiscoverMapMarkersFromFeed,
  type DiscoverFeedMarkerSource,
  type DiscoverMapOutletMarker,
} from '@/lib/discoverMapMarkers';
import { RescueMarker } from '@/components/discover-map/RescueMarker';
import { UserLocationPulse } from '@/components/discover-map/UserLocationPulse';
import { MapControlRail } from '@/components/discover-map/MapControlRail';
import { RescueCountChip } from '@/components/discover-map/RescueCountChip';
import { SelectedRescuePreview } from '@/components/discover-map/SelectedRescuePreview';
import { discoverMapAnimateCamera, DISCOVER_MAP_ZOOM } from '@/lib/mapCamera';
import { getSupabase } from '@/lib/supabase';
import type { StitchTheme } from '@/theme/StitchThemeContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow, stitchFonts } from '@/theme/stitchTokens';
import { formatDistance } from '@/lib/formatDistance';
import { logError } from '@/observability/logError';
import { OutletTrustBadge } from '@/components/OutletTrustBadge';
import { StitchIcon, StitchSurface, StitchText } from '@/ui/stitch';
import type { StitchIconName } from '@/ui/stitch/iconMap';

type LatLng = { lat: number; lng: number };
const DEFAULT_CENTER: LatLng = { lat: FALLBACK_COORDS.lat, lng: FALLBACK_COORDS.lng };

/**
 * Movement thresholds used to decide when to silently re-query `nearby_bags` as the
 * customer moves. Higher speed → larger threshold so we don't burn quota while a
 * passenger drifts through traffic.
 *   <  2 m/s  walking / stopped → 500 m
 *   < 8  m/s  cycling / city traffic → 1 km
 *   >= 8 m/s  driving / faster → auto-refresh pauses (banner takes over)
 */
const SPEED_THRESHOLDS = {
  walkingMaxMs: 2,
  cyclingMaxMs: 8,
} as const;
const REFRESH_KM_WALKING = 0.5;
const REFRESH_KM_CYCLING = 1.0;
/**
 * When follow mode is on, snap the feed query center after this drift so simulator /
 * walking updates refetch without waiting for the 500 m walking tier.
 */
const FOLLOW_FEED_REFRESH_KM = 0.2;
/** "Search this area" appears once the visible map center drifts >0.5 km from `center`. */
const SEARCH_AREA_KM_THRESHOLD = 0.5;

/**
 * Persists the customer's 2D/3D map preference so it survives launches. The flag
 * gates the camera pitch: `true` → 45° pitched view that lets 3D buildings render
 * volumetrically; `false` → flat 0° top-down view.
 */
const MAP_3D_PREFERENCE_KEY = 'fae.discoverMap3D.v1';
/**
 * Whether the Discover map should follow the blue dot after relaunch. `'false'`
 * restores the last explicit “panned away” state; missing key defaults to follow on.
 */
const MAP_FOLLOW_USER_PREFERENCE_KEY = 'fae.discoverMapFollowUser.v1';
const PITCHED_CAMERA_DEGREES = 45;
const FLAT_CAMERA_DEGREES = 0;
/** Programmatic zoom steps — Google Maps uses discrete `zoom`; Apple Maps uses camera `altitude`. */
const MAP_ZOOM_MIN_ANDROID = 4;
const MAP_ZOOM_MAX_ANDROID = 19;
/** Google Maps accepts fractional zoom; we use a whole step of 2 for a clear per-tap change. */
const MAP_ZOOM_STEP_ANDROID = 2;
const IOS_MAP_ALTITUDE_MIN_M = 120;
const IOS_MAP_ALTITUDE_MAX_M = 45_000_000;

/**
 * MapKit FAB zoom — stronger pull when far out, slightly gentler when already close in
 * (altitude in meters). Replaces a single global ratio so each tap stays noticeable
 * without huge jumps near the clamp.
 */
function iosMapAltitudeZoomFactor(altitudeM: number): number {
  if (altitudeM >= 2_500_000) return 2.75;
  if (altitudeM >= 800_000) return 2.55;
  if (altitudeM >= 200_000) return 2.35;
  if (altitudeM >= 50_000) return 2.2;
  if (altitudeM >= 15_000) return 2.05;
  return 1.95;
}

function refreshThresholdKmForSpeed(speed: number | null): number | null {
  if (speed == null) return REFRESH_KM_WALKING;
  if (speed < SPEED_THRESHOLDS.walkingMaxMs) return REFRESH_KM_WALKING;
  if (speed < SPEED_THRESHOLDS.cyclingMaxMs) return REFRESH_KM_CYCLING;
  return null; // paused — show banner, let user refresh manually
}

function formatUpdatedAgo(timestamp: number, now: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return 'Awaiting location';
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Updated just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 1) return 'Updated just now';
  if (diffMin === 1) return 'Updated 1 min ago';
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return 'Updated 1 hr ago';
  return `Updated ${diffHr} hr ago`;
}

const EMPTY_DISCOVER_BAGS: DiscoverBag[] = [];

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'DiscoverTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type CategoryChipId = DiscoverCategoryChipId;

const DISCOVER_CHIPS: {
  id: CategoryChipId;
  label: string;
  icon: StitchIconName;
}[] = [
  { id: 'all', label: 'All', icon: 'restaurant' },
  { id: 'bakery', label: 'Bakery', icon: 'bakery_dining' },
  { id: 'cafe', label: 'Cafe', icon: 'local_cafe' },
  { id: 'meals', label: 'Meals', icon: 'lunch_dining' },
  // `standardized_discover_feed_*` uses an egg-style glyph for groceries. Material
  // has both `egg_alt` and `local_grocery_store`; we use the grocery cart for a
  // clearer affordance.
  { id: 'groceries', label: 'Groceries', icon: 'local_grocery_store' },
  { id: 'supermarket', label: 'Supermarket', icon: 'shopping_bag' },
];

function bagMatchesChip(bag: DiscoverBag, chip: CategoryChipId): boolean {
  return discoverCategoryMatchesChip(bag.category, chip);
}

function shelfMatchesChip(
  item: Extract<DiscoverFeedItem, { kind: 'shelf' }>,
  chip: CategoryChipId,
): boolean {
  return discoverCategoryMatchesChip(item.category, chip);
}

function shortenDiscoverLocationLabel(label: string, maxLen = 24): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Colombo, LK';
  const primary = trimmed.split(',')[0]?.trim() || trimmed;
  if (primary.length <= maxLen) return primary;
  return `${primary.slice(0, maxLen - 1)}…`;
}

/** Nav header pill: city + country/region when space is tight. */
function discoverNavPillLocationLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Colombo, LK';
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const compact = `${parts[0]}, ${parts[parts.length - 1]}`;
    if (compact.length <= 28) return compact;
    return shortenDiscoverLocationLabel(compact, 26);
  }
  return shortenDiscoverLocationLabel(trimmed, 26);
}

/** Current-location row: prefer readable locality + country over full reverse-geocode. */
function discoverMainLocationLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Colombo, LK';
  if (trimmed.length <= 36) return trimmed;
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const country = parts[parts.length - 1]!;
    const locality =
      parts.find((p) => /colombo|^\d{5}$/i.test(p)) ??
      parts.slice(0, 2).join(', ');
    const compact = `${locality}, ${country}`;
    if (compact.length <= 36) return compact;
    return shortenDiscoverLocationLabel(compact, 34);
  }
  return shortenDiscoverLocationLabel(trimmed, 34);
}

function formatLkr(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `LKR ${v.toLocaleString('en-LK')}`;
}

function formatPickupLine(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start || !end) return null;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };
  const a = fmt(start);
  const b = fmt(end);
  if (!a || !b) return null;
  return `Pickup: ${a} - ${b}`;
}

function DiscoverLocationPill(props: {
  label: string;
  onPress: () => void;
}): React.ReactElement {
  const { colors, spacing } = useStitchTheme();
  return (
    <Pressable
      accessibilityRole="button"
      testID="discover.locationPill"
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 999,
        maxWidth: 168,
        minWidth: 0,
        flexShrink: 1,
        flex: 1,
        opacity: pressed ? 0.85 : 1,
        backgroundColor: pressed ? colors.surface2 : 'transparent',
      })}
    >
      <StitchIcon name="location_on" size={18} colorKey="textMuted" />
      <StitchText
        variant="label"
        colorKey="textMuted"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ flexShrink: 1, minWidth: 0 }}
      >
        {props.label}
      </StitchText>
      <StitchIcon name="expand_more" size={18} colorKey="textMuted" />
    </Pressable>
  );
}

/**
 * Stitch `discover_skeleton_loader` shows a CSS shimmer sweep across the placeholder
 * tiles. We reproduce that with an `Animated` `translateX` of a transparent→white→
 * transparent SVG `LinearGradient` overlaid on the card. No extra native deps.
 */
function ShimmerOverlay(): React.ReactElement {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [-220, 320] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ translateX: tx }] },
      ]}
    >
      <Svg height="100%" width={200} viewBox="0 0 200 100" preserveAspectRatio="none">
        <Defs>
          {/* Shimmer gradient stops are intentionally pure white — the alpha
              channel is the only thing that animates, and react-native-svg's
              <Stop> doesn't read from our color tokens. */}
          <SvgLinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="200" height="100" fill="url(#shimmer)" />
      </Svg>
    </Animated.View>
  );
}

function DiscoverSkeletonBlock(props: {
  colors: StitchTheme['colors'];
  spacing: StitchTheme['spacing'];
  radii: StitchTheme['radii'];
}): React.ReactElement {
  const { colors, spacing, radii } = props;
  return (
    <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
      {[0, 1, 2].map((k) => (
        <View
          key={k}
          style={{
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            ...stitchAmbientShadow,
          }}
        >
          <View
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              backgroundColor: colors.surfaceContainerHighest,
              overflow: 'hidden',
            }}
          >
            <ShimmerOverlay />
          </View>
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <View
              style={{
                height: 14,
                width: '36%',
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
            <View
              style={{
                height: 12,
                width: '28%',
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
            <View
              style={{
                height: 16,
                width: '72%',
                marginTop: spacing.xs,
                borderRadius: radii.default,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
              }}
            >
              <View
                style={{
                  height: 12,
                  width: '44%',
                  borderRadius: radii.default,
                  backgroundColor: colors.surfaceContainerHighest,
                }}
              />
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View
                  style={{
                    height: 10,
                    width: 48,
                    borderRadius: radii.default,
                    backgroundColor: colors.surfaceContainerHighest,
                  }}
                />
                <View
                  style={{
                    height: 28,
                    width: 72,
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceContainerHighest,
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function DiscoverBagCard(props: {
  bag: DiscoverBag;
  onOpen: (id: string) => void;
  onOpenOutlet: (outletId: string) => void;
  colors: StitchTheme['colors'];
  spacing: StitchTheme['spacing'];
  radii: StitchTheme['radii'];
}): React.ReactElement {
  const { bag, onOpen, onOpenOutlet, colors, spacing, radii } = props;
  const { mode } = useStitchTheme();
  const qty = bag.quantity_remaining;
  const soldOut = typeof qty === 'number' && qty <= 0;
  const pickupLine = formatPickupLine(bag.pickup_start, bag.pickup_end);
  const retail = bag.retail_value_estimate;
  const showStrike =
    typeof retail === 'number' &&
    retail > bag.rescue_price &&
    !soldOut;

  const qtyLabel =
    typeof qty === 'number'
      ? qty === 1
        ? '1 bag left'
        : qty > 1
          ? `${qty} bags left`
          : 'Sold out'
      : null;

  return (
    <Pressable
      onPress={() => onOpen(bag.id)}
      style={({ pressed }) => ({
        opacity: soldOut ? 0.75 : pressed ? 0.96 : 1,
        marginBottom: spacing.md,
      })}
    >
      <StitchSurface
        elevated
        padding="none"
        style={{
          overflow: 'hidden',
          borderRadius: radii.xl,
          opacity: 1,
        }}
      >
        <View style={{ position: 'relative' }}>
          {bag.image_url ? (
            <Image
              source={{ uri: bag.image_url }}
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                backgroundColor: colors.surfaceContainerHighest,
              }}
              resizeMode="cover"
              accessibilityLabel={`${bag.outlet_name ?? 'Outlet'} preview`}
            />
          ) : (
            <View
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                backgroundColor: colors.surfaceContainerHighest,
              }}
            />
          )}
          {soldOut ? (
            <View
              style={{
                ...StyleSheet.absoluteFill,
                backgroundColor: `${colors.surface}33`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.lg,
                  backgroundColor: `${colors.darkSurface}CC`,
                }}
              >
                <StitchText variant="label" colorKey="onPrimary">
                  Sold out
                </StitchText>
              </View>
            </View>
          ) : null}
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              left: spacing.sm,
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: soldOut
                  ? colors.surface2
                  : colors.primaryHighlight,
              }}
            >
              <StitchText
                variant="body-sm"
                colorKey={
                  soldOut ? 'textMuted' : mode === 'dark' ? 'onPrimary' : 'primaryActive'
                }
                style={{ fontFamily: stitchFonts.semiBold }}
              >
                {bag.category?.trim() || 'Rescue'}
              </StitchText>
            </View>
          </View>
          {qtyLabel ? (
            <View
              style={{
                position: 'absolute',
                top: spacing.sm,
                right: spacing.sm,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: soldOut
                    ? colors.surfaceDim
                    : colors.accent,
                }}
              >
                <StitchText
                  variant="body-sm"
                  colorKey={soldOut ? 'textFaint' : 'onPrimary'}
                  style={{ fontFamily: stitchFonts.bold }}
                >
                  {qtyLabel}
                </StitchText>
              </View>
            </View>
          ) : null}
          {/*
            Stitch `standardized_discover_feed_*` shows a small floating `favorite`
            FAB on each card. We render a visual-only heart pill in the bottom-right
            of the hero — the surrounding row is a Pressable, so this isn't a
            separate action target (closing the per-card heart gap noted in the
            matrix without forking the card press handler).
          */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: spacing.sm,
              right: spacing.sm,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: `${colors.surface}E6`,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <StitchIcon name="favorite_border" size={20} colorKey="primary" />
          </View>
        </View>

        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <View>
            {bag.outlet_id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${bag.outlet_name ?? 'outlet'} profile`}
                onPress={() => onOpenOutlet(bag.outlet_id as string)}
                hitSlop={6}
              >
                <StitchText variant="body-sm" colorKey="textMuted">
                  {bag.outlet_name ?? 'Local partner'}
                </StitchText>
              </Pressable>
            ) : (
              <StitchText variant="body-sm" colorKey="textMuted">
                {bag.outlet_name ?? 'Local partner'}
              </StitchText>
            )}
            <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <OutletTrustBadge
                size="sm"
                trustScore={bag.trust_score}
                averageRating={bag.average_rating}
                totalReviews={bag.total_reviews}
                collectionRatePct={bag.collection_rate_pct}
                complaintRatePct={bag.complaint_rate_pct}
                noShowRatePct={bag.no_show_rate_pct}
              />
            </View>
            <StitchText
              variant="h3"
              colorKey={soldOut ? 'textMuted' : 'text'}
              style={{ marginTop: 4 }}
              numberOfLines={2}
            >
              {bag.title}
            </StitchText>
          </View>

          {pickupLine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <StitchIcon
                name="schedule"
                size={18}
                colorKey={soldOut ? 'textFaint' : 'textMuted'}
              />
              <StitchText
                variant="body-sm"
                colorKey={soldOut ? 'textFaint' : 'textMuted'}
              >
                {pickupLine}
              </StitchText>
            </View>
          ) : null}
          {/*
            `standardized_discover_feed_*` distance row. We surface
            `outlets.distance_km` (computed by the `nearby_bags` RPC); falls back to
            "Near you" when distance isn't available (RPC fallback path, or zero
            customer geolocation yet).
          */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <StitchIcon
              name="location_on"
              size={18}
              colorKey={soldOut ? 'textFaint' : 'textMuted'}
            />
            <StitchText
              variant="body-sm"
              colorKey={soldOut ? 'textFaint' : 'textMuted'}
            >
              {formatDistance(bag.distance_km)}
            </StitchText>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: spacing.sm,
            }}
          >
            <View>
              {showStrike ? (
                <StitchText variant="price-original" colorKey="textMuted">
                  {formatLkr(retail)}
                </StitchText>
              ) : null}
              <StitchText
                variant="price"
                colorKey={soldOut ? 'textMuted' : 'accent'}
              >
                {formatLkr(bag.rescue_price)}
              </StitchText>
            </View>
            <View
              style={{
                backgroundColor: soldOut
                  ? colors.surfaceDim
                  : colors.surfaceTint,
                paddingHorizontal: spacing.md,
                paddingVertical: 12,
                borderRadius: radii.lg,
              }}
            >
              <StitchText
                variant="label"
                colorKey={soldOut ? 'textFaint' : 'onPrimary'}
              >
                Reserve
              </StitchText>
            </View>
          </View>
        </View>
      </StitchSurface>
    </Pressable>
  );
}

function DiscoverShelfCard(props: {
  item: Extract<DiscoverFeedItem, { kind: 'shelf' }>;
  onOpen: (id: string) => void;
  onOpenOutlet: (outletId: string) => void;
  colors: StitchTheme['colors'];
  spacing: StitchTheme['spacing'];
  radii: StitchTheme['radii'];
}): React.ReactElement {
  const { item, onOpen, onOpenOutlet, colors, spacing, radii } = props;
  const pickupLine = formatPickupLine(item.pickup_start ?? null, item.pickup_end ?? null);
  const thumb = item.thumbnails?.[0];

  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        marginBottom: spacing.md,
      })}
    >
      <StitchSurface elevated padding="none" style={{ overflow: 'hidden', borderRadius: radii.xl }}>
        <View style={{ position: 'relative' }}>
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceContainerHighest }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceContainerHighest }} />
          )}
          <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', gap: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.accent }}>
              <StitchText variant="body-sm" colorKey="onPrimary" style={{ fontFamily: stitchFonts.semiBold }}>
                Pick your own
              </StitchText>
            </View>
          </View>
          {item.itemCount > 0 ? (
            <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primaryHighlight }}>
                <StitchText variant="body-sm" colorKey="primaryActive" style={{ fontFamily: stitchFonts.bold }}>
                  {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                </StitchText>
              </View>
            </View>
          ) : null}
        </View>
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          {item.outlet_id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View shop — ${item.outlet_name ?? 'outlet'}`}
              onPress={(e) => {
                e.stopPropagation?.();
                onOpenOutlet(item.outlet_id!);
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                alignSelf: 'flex-start',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                View shop · {item.outlet_name ?? 'Supermarket'}
              </StitchText>
              <StitchIcon name="chevron_right" size={18} colorKey="primaryContainer" />
            </Pressable>
          ) : (
            <StitchText variant="body-sm" colorKey="textMuted">
              {item.outlet_name ?? 'Supermarket'}
            </StitchText>
          )}
          <StitchText variant="h3" colorKey="text">
            Today&apos;s clearance shelf
          </StitchText>
          {item.previewItemNames && item.previewItemNames.length > 0 ? (
            <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
              {item.previewItemNames.join(' · ')}
            </StitchText>
          ) : null}
          {item.savingsPercentMin != null && item.savingsPercentMax != null ? (
            <StitchText variant="body-sm" colorKey="secondary">
              {item.savingsPercentMin === item.savingsPercentMax
                ? `Save up to ${item.savingsPercentMax}%`
                : `Save ${item.savingsPercentMin}–${item.savingsPercentMax}%`}
            </StitchText>
          ) : null}
          {pickupLine ? (
            <StitchText variant="body-sm" colorKey="textMuted">
              Pickup {pickupLine}
            </StitchText>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <StitchText variant="price" colorKey="accent">
              From {formatLkr(item.minPrice)}
            </StitchText>
            <StitchText variant="label" colorKey="onPrimary">
              Browse shelf
            </StitchText>
          </View>
        </View>
      </StitchSurface>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const tabRoute =
    useRoute<RouteProp<CustomerTabParamList, 'DiscoverTab'>>();
  const { env, session } = useAuthContext();
  const { colors, spacing, radii, colorScheme } = useStitchTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  /**
   * Taller than the old 34% block — the map is now a direct pan/zoom surface
   * (map-first touch zone), so it earns more room while the feed stays the
   * dominant scroll area below.
   */
  const mapHeight = useMemo(
    () => Math.round(Math.min(Math.max(windowHeight * 0.42, 250), 460)),
    [windowHeight],
  );
  const styles = useDiscoverStyles(colors, spacing, radii, mapHeight);
  const customMapStyle = useMemo(() => mapStyleForScheme(colorScheme), [colorScheme]);
  const searchRef = useRef<TextInput>(null);
  const mapRef = useRef<MapView>(null);
  const feedListRef = useRef<FlatList<DiscoverFeedItem>>(null);
  /** Skips the first pitch `animateCamera` after prefs hydrate (`initialCamera` is enough). */
  const mapPitchIntroSkippedRef = useRef(false);
  const {
    location: userLocation,
    isUsingFallback,
    status: locationStatus,
    requestPermission,
    refresh: refreshLocation,
  } = useUserLocation({ enabled: isFocused });

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [regionLabel, setRegionLabel] = useState<string | null>(null);
  /** Reverse-geocoded label for nav pill when GPS is live (not search). */
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<LocationHit[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [placeSearchErr, setPlaceSearchErr] = useState<string | null>(null);
  const [locationSheetMode, setLocationSheetMode] = useState<'menu' | 'place'>('menu');
  const [refreshing, setRefreshing] = useState(false);
  const placeSearchRef = useRef<TextInput>(null);
  const [selectedChip, setSelectedChip] = useState<CategoryChipId>('all');
  /**
   * Stitch `discover_sold_out_transition` — opt-in "Include sold out" pill that flips
   * `useNearbyBags` between `.gt('quantity_remaining', 0)` and no filter. When ON the
   * dimmed sold-out card chrome (already wired in the row component) surfaces.
   */
  const [includeSoldOut, setIncludeSoldOut] = useState(false);
  /**
   * Follows the live blue-dot. Default ON when permission is granted; flips OFF as soon
   * as the user pans the map so we don't fight their gesture. The "Recenter" FAB
   * flips it back on. Persisted across launches (`fae.discoverMapFollowUser.v1`);
   * only explicit `'false'` restores a non-following cold start.
   */
  const [followingUser, setFollowingUser] = useState(true);
  /**
   * What the map is currently centred on (driven by `onRegionChangeComplete`). When this
   * drifts >SEARCH_AREA_KM_THRESHOLD from `center`, the "Search this area" CTA appears.
   */
  const [viewportCenter, setViewportCenter] = useState(DEFAULT_CENTER);
  /** Re-renders the "Updated X min ago" pill every 30 seconds. */
  const [tick, setTick] = useState(() => Date.now());
  /**
   * 2D vs 3D camera preference (pitch + native buildings), not satellite imagery.
   * Defaults to **3D** (pitched buildings). Hydrates from AsyncStorage on mount: only
   * an explicit saved `'false'` flattens the map; missing or `'true'` keeps 3D.
   * MapView mounts only after prefs hydrate so `initialCamera` matches this value.
   */
  const [map3DEnabled, setMap3DEnabled] = useState(true);
  /** After AsyncStorage map prefs load — gates MapView mount + pitch animation. */
  const [mapViewPrefsHydrated, setMapViewPrefsHydrated] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  /**
   * Map pin selection — drives the swollen pin state and the slide-up rescue
   * preview card. Cleared by tapping the map background or the card's ×.
   */
  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(null);
  /**
   * True once the user pans/zooms the map themselves — programmatic camera
   * moves (fit-to-pins, follow, recenter) shouldn't surface "Search this
   * area", only a deliberate exploration gesture should.
   */
  const [mapExploredByGesture, setMapExploredByGesture] = useState(false);
  /** One-time entry motion for the whole map block after prefs hydrate. */
  const mapIntro = useRef(new Animated.Value(0)).current;

  /**
   * Road/vector map only — `hybrid` / `hybridFlyover` read as satellite-style to users.
   * 3D is handled with `standard` + pitch + `showsBuildings` / `pitchEnabled` (tied to
   * `map3DEnabled`), consistent on iOS (Apple) and Android (Google).
   */
  const discoverMapType = useMemo((): MapType => 'standard', []);

  const { bags, feedItems, loading, error, refetch } = useNearbyBags(
    env,
    center.lat,
    center.lng,
    { includeSoldOut },
  );

  const forcedFromLink = tabRoute.params?.state
    ? parseDiscoverState(tabRoute.params.state)
    : null;
  const displayBags = useMemo(
    () => (forcedFromLink != null ? EMPTY_DISCOVER_BAGS : bags),
    [forcedFromLink, bags],
  );
  const forcedCopy =
    forcedFromLink != null ? DISCOVER_EMPTY_COPY[forcedFromLink] : null;

  const filteredBags = useMemo(
    () => displayBags.filter((b) => bagMatchesChip(b, selectedChip)),
    [displayBags, selectedChip],
  );

  const listBags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredBags;
    return filteredBags.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.outlet_name?.toLowerCase().includes(q) ?? false),
    );
  }, [filteredBags, searchQuery]);

  const displayFeed = useMemo((): DiscoverFeedItem[] => {
    if (forcedFromLink != null) return [];
    if (feedItems?.length) return feedItems;
    return listBags.map((b) => ({
      kind: 'bag' as const,
      payload: b as unknown as Record<string, unknown>,
      ...b,
    }));
  }, [forcedFromLink, feedItems, listBags]);

  const filteredFeed = useMemo(
    () =>
      displayFeed.filter((item) =>
        item.kind === 'shelf'
          ? shelfMatchesChip(item, selectedChip)
          : bagMatchesChip(item as unknown as DiscoverBag, selectedChip),
      ),
    [displayFeed, selectedChip],
  );

  const listFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredFeed;
    return filteredFeed.filter((item) => {
      if (item.kind === 'shelf') {
        const name = (item.outlet_name ?? '').toLowerCase();
        return name.includes(q) || q.includes('clearance') || q.includes('shelf');
      }
      if (item.kind !== 'bag') return false;
      const bag = item as unknown as DiscoverBag;
      return (
        bag.title?.toLowerCase().includes(q) ||
        (bag.outlet_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [filteredFeed, searchQuery]);

  const locationDisplayLabel =
    regionLabel ?? geoLabel ?? profileCity ?? 'Colombo, LK';

  const locationShortLabel = useMemo(
    () => discoverMainLocationLabel(locationDisplayLabel),
    [locationDisplayLabel],
  );

  const locationPillLabel = useMemo(
    () => discoverNavPillLocationLabel(locationDisplayLabel),
    [locationDisplayLabel],
  );

  const isGuestDiscover = session == null;
  const showGuestFeedSignIn = shouldShowDiscoverGuestSignIn({
    isGuest: isGuestDiscover,
    loading,
    displayFeedLength: displayFeed.length,
  });
  const listEmptyCopy = useMemo(
    () =>
      resolveDiscoverListEmptyCopy({
        isGuest: isGuestDiscover,
        loading,
        listFeedLength: listFeed.length,
        displayFeedLength: displayFeed.length,
        searchQuery,
      }),
    [
      isGuestDiscover,
      loading,
      listFeed.length,
      displayFeed.length,
      searchQuery,
    ],
  );

  const hasLiveUserLocation =
    locationStatus === 'granted' &&
    !isUsingFallback &&
    userLocation.timestamp > 0 &&
    isPlausibleUserCoords(userLocation.lat, userLocation.lng);

  const simulatorLocationMode = isRunningInSimulator();

  useEffect(() => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console -- simulator location QA
    console.log('[DiscoverScreen] location state', {
      simulatorLocationMode,
      hasLiveUserLocation,
      locationStatus,
      isUsingFallback,
      lat: userLocation.lat,
      lng: userLocation.lng,
      timestamp: userLocation.timestamp,
    });
  }, [
    simulatorLocationMode,
    hasLiveUserLocation,
    locationStatus,
    isUsingFallback,
    userLocation.lat,
    userLocation.lng,
    userLocation.timestamp,
  ]);

  useEffect(() => {
    if (!hasLiveUserLocation) {
      setGeoLabel(null);
      return;
    }
    let cancelled = false;
    void fetchLocationReverse(env, userLocation.lat, userLocation.lng)
      .then((label) => {
        if (cancelled) return;
        const trimmed = label.trim();
        if (trimmed.length > 0) {
          setGeoLabel(trimmed);
        }
      })
      .catch((err: unknown) =>
        logError(err, { context: 'DiscoverScreen.reverseGeocode' }),
      );
    return () => {
      cancelled = true;
    };
  }, [
    env,
    hasLiveUserLocation,
    userLocation.lat,
    userLocation.lng,
  ]);
  const discoverMapMarkerFeed = useMemo((): DiscoverFeedMarkerSource[] => {
    return listFeed.map((item) => {
      if (item.kind === 'shelf') {
        return {
          kind: 'shelf' as const,
          id: item.id,
          outlet_id: item.outlet_id,
          outlet_name: item.outlet_name,
          outlet_lat: item.outlet_lat,
          outlet_lng: item.outlet_lng,
          category: item.category,
        };
      }
      const bag = item as unknown as DiscoverBag;
      return {
        kind: 'bag' as const,
        id: bag.id,
        title: bag.title,
        outlet_id: bag.outlet_id,
        outlet_name: bag.outlet_name,
        outlet_lat: bag.outlet_lat,
        outlet_lng: bag.outlet_lng,
        category: bag.category,
        outlet_category: bag.outlet_category,
        quantity_remaining: bag.quantity_remaining,
      };
    });
  }, [listFeed]);

  const discoverMapMarkers = useMemo(
    () =>
      buildDiscoverMapMarkersFromFeed(discoverMapMarkerFeed, {
        onSkipInvalid: __DEV__
          ? (item, reason) => {
              // eslint-disable-next-line no-console -- dev-only map QA
              console.log('[DiscoverMap] skip marker', reason, item.kind, item.id);
            }
          : undefined,
      }),
    [discoverMapMarkerFeed],
  );

  /**
   * Camera framing for the rescue pin set. A single pin gets a comfortable
   * city-block zoom (fitToCoordinates on one point slams to max zoom);
   * multiple pins are fitted with padding that clears the floating chrome.
   */
  const frameRescuePins = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map || discoverMapMarkers.length === 0) return;
      if (discoverMapMarkers.length === 1) {
        const only = discoverMapMarkers[0]!;
        map.animateCamera(
          discoverMapAnimateCamera(
            { lat: only.coordinate.latitude, lng: only.coordinate.longitude },
            map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
            DISCOVER_MAP_ZOOM,
          ),
          { duration: animated ? 420 : 0 },
        );
        return;
      }
      map.fitToCoordinates(
        discoverMapMarkers.map((m) => m.coordinate),
        {
          edgePadding: { top: 90, right: 70, bottom: 100, left: 70 },
          animated,
        },
      );
    },
    [discoverMapMarkers, map3DEnabled],
  );

  /**
   * Frame all rescue pins when the *set of outlets* changes — not on every
   * feed refetch (identity churn) and never while the user is mid-exploration
   * with the same pins, so panning is never yanked back by a background
   * refresh. First framing is instant; later ones glide.
   */
  const lastMarkerFitSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapViewPrefsHydrated || discoverMapMarkers.length === 0) return;
    const signature = discoverMapMarkers
      .map((m) => m.markerKey)
      .sort()
      .join('|');
    if (lastMarkerFitSignatureRef.current === signature) return;
    const firstFit = lastMarkerFitSignatureRef.current === null;
    lastMarkerFitSignatureRef.current = signature;
    setFollowingUser(false);
    frameRescuePins(!firstFit);
  }, [discoverMapMarkers, frameRescuePins, mapViewPrefsHydrated]);

  const openLocationSheet = useCallback(() => {
    setLocationSheetMode('menu');
    setPlaceSearchQuery('');
    setPlaceSuggestions([]);
    setPlaceSearchErr(null);
    setLocationSheetOpen(true);
  }, []);

  const closeLocationSheet = useCallback(() => {
    setLocationSheetOpen(false);
    setLocationSheetMode('menu');
  }, []);

  const focusPlaceSearchInput = useCallback((attempt = 0) => {
    if (attempt > 4) return;
    const input = placeSearchRef.current;
    if (input) {
      input.focus();
      return;
    }
    requestAnimationFrame(() => focusPlaceSearchInput(attempt + 1));
  }, []);

  const openPlaceSearchInSheet = useCallback(() => {
    setLocationSheetMode('place');
    InteractionManager.runAfterInteractions(() => {
      focusPlaceSearchInput();
    });
  }, [focusPlaceSearchInput]);

  useEffect(() => {
    if (!locationSheetOpen || locationSheetMode !== 'place') return;
    InteractionManager.runAfterInteractions(() => {
      focusPlaceSearchInput();
    });
  }, [locationSheetOpen, locationSheetMode, focusPlaceSearchInput]);

  const renderHeaderRight = useCallback(
    () => (
      <DiscoverLocationPill label={locationPillLabel} onPress={openLocationSheet} />
    ),
    [locationPillLabel, openLocationSheet],
  );
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: renderHeaderRight });
  }, [navigation, renderHeaderRight]);

  useEffect(() => {
    scheduleMicrotask(() => {
      refetch().catch((err) =>
        logError(err, { context: 'DiscoverScreen.initialRefetch' }),
      );
    });
  }, [refetch]);

  const hadSessionRef = useRef(false);
  useEffect(() => {
    if (session && !hadSessionRef.current) {
      refetch().catch((err) =>
        logError(err, { context: 'DiscoverScreen.sessionRefetch' }),
      );
    }
    hadSessionRef.current = Boolean(session);
  }, [session, refetch]);

  useFocusEffect(
    useCallback(() => {
      refetch().catch((err) =>
        logError(err, { context: 'DiscoverScreen.focusRefetch' }),
      );
      const uid = session?.user?.id;
      if (!uid) return;
      void (async () => {
        try {
          const { data } = await getSupabase(env)
            .from('profiles')
            .select('city')
            .eq('id', uid)
            .maybeSingle();
          const city =
            typeof data?.city === 'string' && data.city.trim().length > 0
              ? data.city.trim()
              : null;
          setProfileCity(city);
        } catch (err: unknown) {
          logError(err, { context: 'DiscoverScreen.focusProfileCity' });
        }
      })();
    }, [env, refetch, session?.user?.id]),
  );

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfileCity(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getSupabase(env)
          .from('profiles')
          .select('city')
          .eq('id', uid)
          .maybeSingle();
        if (cancelled) return;
        const city =
          typeof data?.city === 'string' && data.city.trim().length > 0
            ? data.city.trim()
            : null;
        setProfileCity(city);
      } catch (err: unknown) {
        logError(err, { context: 'DiscoverScreen.loadProfileCity' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [env, session?.user?.id]);

  const persistProfileCity = useCallback(
    async (city: string) => {
      const trimmed = city.trim();
      if (!trimmed || !session?.user?.id) return;
      setProfileCity(trimmed);
      try {
        await getSupabase(env)
          .from('profiles')
          .update({ city: trimmed })
          .eq('id', session.user.id);
      } catch (err: unknown) {
        logError(err, { context: 'DiscoverScreen.persistProfileCity' });
      }
    },
    [env, session?.user?.id],
  );

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
      await refreshLocation();
    } catch (err: unknown) {
      logError(err, { context: 'DiscoverScreen.pullRefresh' });
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refreshLocation]);

  useEffect(() => {
    if (!__DEV__ || bags.length === 0) return;
    try {
      assertUniqueNearbyBagIds(bags as { id: unknown }[]);
    } catch (err) {
      // Dev-only invariant assertion. Funnel through `logError` so the
      // warning posture matches the rest of the screen instead of a stray
      // `console.warn` that bypasses our observability pipeline.
      logError(err, { context: 'DiscoverScreen.assertUniqueIds' });
    }
  }, [bags]);

  /**
   * Smart re-query: when the user moves more than the speed-tiered threshold from the
   * coordinates the feed was last queried at, snap `center` to their current location.
   * The setCenter triggers `useNearbyBags` to refetch automatically.
   *
   * At driving speed (>=8 m/s) `refreshThresholdKmForSpeed` returns null and we leave
   * `center` alone — the high-speed banner takes over the affordance instead so the
   * map and feed don't strobe while the user is in a moving car.
   */
  useEffect(() => {
    if (!hasLiveUserLocation) return;
    const threshold = followingUser
      ? FOLLOW_FEED_REFRESH_KM
      : simulatorLocationMode
        ? REFRESH_KM_WALKING
        : refreshThresholdKmForSpeed(userLocation.speed);
    if (threshold == null) return;
    const drift = haversineKm(
      center.lat,
      center.lng,
      userLocation.lat,
      userLocation.lng,
    );
    if (Number.isFinite(drift) && drift >= threshold) {
      const next = { lat: userLocation.lat, lng: userLocation.lng };
      setCenter(next);
      if (followingUser) {
        setViewportCenter(next);
      }
    }
  }, [
    followingUser,
    hasLiveUserLocation,
    simulatorLocationMode,
    userLocation.lat,
    userLocation.lng,
    userLocation.speed,
    center.lat,
    center.lng,
  ]);

  /**
   * First-fix bootstrap: as soon as a live fix arrives (regardless of drift), snap the
   * feed to the user's position so the very first paint is "real" instead of Colombo.
   * Only fires once — gated on `isUsingFallback` flipping false.
   */
  const bootstrappedToUserRef = useRef(false);
  useEffect(() => {
    if (!bootstrappedToUserRef.current && hasLiveUserLocation) {
      bootstrappedToUserRef.current = true;
      setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setViewportCenter({ lat: userLocation.lat, lng: userLocation.lng });
      // Outlet pins take priority over follow-user camera on first paint.
      if (discoverMapMarkers.length > 0) {
        setFollowingUser(false);
        return;
      }
      mapRef.current?.animateCamera(
        discoverMapAnimateCamera(
          { lat: userLocation.lat, lng: userLocation.lng },
          map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
          DISCOVER_MAP_ZOOM,
        ),
        { duration: 450 },
      );
    }
  }, [
    discoverMapMarkers.length,
    hasLiveUserLocation,
    map3DEnabled,
    userLocation.lat,
    userLocation.lng,
  ]);

  /**
   * When following is on, gently animate the camera to keep the blue dot centred as
   * the user walks. We don't recenter when they're moving fast (banner state) — we
   * still let them pan freely.
   */
  useEffect(() => {
    if (!followingUser || !hasLiveUserLocation) return;
    // City Run reports unrealistic speed; keep follow + camera sync on simulator.
    if (
      !simulatorLocationMode &&
      typeof userLocation.speed === 'number' &&
      userLocation.speed >= SPEED_THRESHOLDS.cyclingMaxMs
    ) {
      return;
    }
    // `animateCamera` (vs `animateToRegion`) preserves the user's 2D/3D
    // pitch choice. With `animateToRegion` this effect would fire on every
    // location update and snap pitch back to 0°, defeating the 3D toggle
    // while follow mode is on.
    mapRef.current?.animateCamera(
      {
        center: { latitude: userLocation.lat, longitude: userLocation.lng },
        pitch: map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
      },
      { duration: 450 },
    );
  }, [
    followingUser,
    hasLiveUserLocation,
    simulatorLocationMode,
    map3DEnabled,
    userLocation.lat,
    userLocation.lng,
    userLocation.speed,
  ]);

  /** "Updated X min ago" tick so the pill ages without us refetching. */
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * Hydrate persisted map view prefs (same keys on iOS + Android).
   * 3D: default on; only explicit `'false'` flattens. Follow: default on; `'false'` off.
   */
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(MAP_3D_PREFERENCE_KEY),
      AsyncStorage.getItem(MAP_FOLLOW_USER_PREFERENCE_KEY),
    ])
      .then(([raw3d, rawFollow]) => {
        if (cancelled) return;
        if (raw3d === 'false') setMap3DEnabled(false);
        if (rawFollow === 'false') setFollowingUser(false);
      })
      .catch((err: unknown) =>
        logError(err, { context: 'DiscoverScreen.hydrateMapPrefs' }),
      )
      .finally(() => {
        if (!cancelled) setMapViewPrefsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist 3D + follow preferences whenever they change (after initial hydration). */
  useEffect(() => {
    if (!mapViewPrefsHydrated) return;
    Promise.all([
      AsyncStorage.setItem(MAP_3D_PREFERENCE_KEY, map3DEnabled ? 'true' : 'false'),
      AsyncStorage.setItem(
        MAP_FOLLOW_USER_PREFERENCE_KEY,
        followingUser ? 'true' : 'false',
      ),
    ]).catch((err: unknown) =>
      logError(err, { context: 'DiscoverScreen.persistMapPrefs' }),
    );
  }, [map3DEnabled, followingUser, mapViewPrefsHydrated]);

  /**
   * Whenever the 2D/3D preference flips, animate the camera pitch. We don't touch
   * heading/zoom — those stay wherever the user left them — only `pitch` toggles
   * between flat and `PITCHED_CAMERA_DEGREES`. First paint after hydration already
   * matches `initialCamera`, so we skip one redundant animation.
   */
  useEffect(() => {
    if (!mapViewPrefsHydrated) return;
    if (!mapPitchIntroSkippedRef.current) {
      mapPitchIntroSkippedRef.current = true;
      return;
    }
    const cam: Partial<Camera> = {
      pitch: map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
    };
    mapRef.current?.animateCamera(cam, { duration: 450 });
  }, [map3DEnabled, mapViewPrefsHydrated]);

  const toggleMap3D = useCallback(() => {
    setMap3DEnabled((v) => !v);
  }, []);

  const openBag = useCallback(
    (id: string) => {
      navigation.getParent()?.navigate('BagDetail', { id });
    },
    [navigation],
  );

  const openOutlet = useCallback(
    (outletId: string) => {
      navigation.getParent()?.navigate('OutletDetail', { outletId });
    },
    [navigation],
  );

  const openShelf = useCallback(
    (id: string) => {
      navigation.getParent()?.navigate('ClearanceShelf', { id });
    },
    [navigation],
  );

  /** Open the rescue behind a pin: outlet detail first, else bag/shelf detail. */
  const openRescueMarker = useCallback(
    (marker: DiscoverMapOutletMarker) => {
      if (marker.outletId) {
        openOutlet(marker.outletId);
        return;
      }
      if (marker.feedKind === 'shelf') {
        openShelf(marker.feedItemId);
        return;
      }
      openBag(marker.feedItemId);
    },
    [openBag, openOutlet, openShelf],
  );

  const deselectRescueMarker = useCallback(() => {
    setSelectedMarkerKey(null);
  }, []);

  const selectedRescueMarker = useMemo(
    () =>
      selectedMarkerKey == null
        ? null
        : discoverMapMarkers.find((m) => m.markerKey === selectedMarkerKey) ??
          null,
    [discoverMapMarkers, selectedMarkerKey],
  );

  /**
   * First tap on a pin selects it: haptic tick, pin swells, camera eases over,
   * and the preview card slides up — the page deliberately does NOT jump away
   * from the map. Tapping the already-selected pin (or the preview card)
   * opens the rescue.
   */
  const onRescueMarkerPress = useCallback(
    (marker: DiscoverMapOutletMarker) => {
      if (selectedMarkerKey === marker.markerKey) {
        openRescueMarker(marker);
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedMarkerKey(marker.markerKey);
      setFollowingUser(false);
      mapRef.current?.animateCamera(
        { center: marker.coordinate },
        { duration: 320 },
      );
    },
    [openRescueMarker, selectedMarkerKey],
  );

  const openRescueFromPreview = useCallback(
    (marker: DiscoverMapOutletMarker) => {
      openRescueMarker(marker);
    },
    [openRescueMarker],
  );

  /**
   * First paint after prefs hydrate: pitch matches saved 2D/3D (MapView mounts only
   * once `mapViewPrefsHydrated` is true so `initialCamera` is never wrong).
   */
  const initialCamera = useMemo((): Camera => {
    const cam = discoverMapAnimateCamera(
      { lat: center.lat, lng: center.lng },
      map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
      DISCOVER_MAP_ZOOM,
    );
    return {
      center: cam.center!,
      pitch: cam.pitch ?? FLAT_CAMERA_DEGREES,
      heading: 0,
      ...(cam.zoom != null ? { zoom: cam.zoom } : {}),
      ...(cam.altitude != null ? { altitude: cam.altitude } : {}),
    };
  }, [map3DEnabled, center.lat, center.lng]);

  /**
   * Location bootstrap may run before the map exists (prefs still hydrating). When
   * the map later mounts, snap once if we already committed to the user’s GPS.
   */
  const onMapReady = useCallback(() => {
    if (discoverMapMarkers.length > 0) {
      lastMarkerFitSignatureRef.current = discoverMapMarkers
        .map((m) => m.markerKey)
        .sort()
        .join('|');
      setFollowingUser(false);
      frameRescuePins(false);
      return;
    }
    if (!bootstrappedToUserRef.current || !hasLiveUserLocation) {
      return;
    }
    mapRef.current?.animateCamera(
      discoverMapAnimateCamera(
        { lat: userLocation.lat, lng: userLocation.lng },
        map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
        DISCOVER_MAP_ZOOM,
      ),
      { duration: 0 },
    );
  }, [
    discoverMapMarkers,
    frameRescuePins,
    hasLiveUserLocation,
    map3DEnabled,
    userLocation.lat,
    userLocation.lng,
  ]);

  /**
   * Fires only for real finger drags on the map (never for programmatic
   * camera moves) — the reliable "user is exploring" signal. Some iOS builds
   * don't deliver `isGesture` on `onRegionChangeComplete`, so this is the
   * primary hook; the region-change check below is a fallback.
   */
  const onMapPanDrag = useCallback(() => {
    setMapExploredByGesture(true);
    setFollowingUser(false);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (next: Region, details?: { isGesture?: boolean }) => {
      setViewportCenter({ lat: next.latitude, lng: next.longitude });
      // A finger on the map means the user is exploring — stop snapping the
      // camera back to the blue dot and arm the "Search this area" pill.
      // `isGesture` distinguishes their pan from our own programmatic camera
      // moves (follow, fit, recenter), so this is reliable on simulator and
      // device alike. The recenter rail button flips follow back on.
      if (details?.isGesture) {
        setMapExploredByGesture(true);
        if (followingUser) setFollowingUser(false);
      }
    },
    [followingUser],
  );

  const recenterOnUser = useCallback(() => {
    if (!hasLiveUserLocation) {
      void requestPermission();
      return;
    }
    setFollowingUser(true);
    setMapExploredByGesture(false);
    setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    // Mirror the recenter target into `viewportCenter` synchronously so the
    // drift calc against `center` sees the matched value immediately. Without
    // this the ~450 ms `animateCamera` window leaves `viewportCenter` stale
    // and the "Search this area" pill can momentarily flash before
    // `onRegionChangeComplete` confirms the same coords.
    setViewportCenter({ lat: userLocation.lat, lng: userLocation.lng });
    setRegionLabel(null);
    void refreshLocation().then(() => {
      void fetchLocationReverse(env, userLocation.lat, userLocation.lng)
        .then((label) => {
          const trimmed = label.trim();
          if (trimmed.length > 0) {
            setGeoLabel(trimmed);
            void persistProfileCity(trimmed);
          }
        })
        .catch((err: unknown) =>
          logError(err, { context: 'DiscoverScreen.recenterReverseGeocode' }),
        );
    });
    /**
     * `animateCamera` (vs `animateToRegion`) lets us preserve the user's pitch
     * preference so the 3D view doesn't flatten every time they tap Recenter.
     */
    mapRef.current?.animateCamera(
      discoverMapAnimateCamera(
        { lat: userLocation.lat, lng: userLocation.lng },
        map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
        DISCOVER_MAP_ZOOM,
      ),
      { duration: 450 },
    );
  }, [
    env,
    hasLiveUserLocation,
    map3DEnabled,
    persistProfileCity,
    refreshLocation,
    requestPermission,
    userLocation.lat,
    userLocation.lng,
  ]);

  /**
   * FAB zoom in/out — uses `getCamera` so pinch / search / recenter never desync the
   * step baseline. Android adjusts `zoom`; iOS adjusts MKMapCamera `altitude` (the JS
   * `zoom` field is ignored by MapKit). Turning off follow matches the pan gesture: the
   * user explicitly reframed the map.
   */
  const nudgeDiscoverMapZoom = useCallback(
    (direction: 'in' | 'out') => {
      const map = mapRef.current;
      if (!map || !mapViewPrefsHydrated) return;
      setFollowingUser(false);
      const pitch = map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES;
      const apply = (cam: Camera) => {
        const center = cam.center;
        const heading =
          typeof cam.heading === 'number' && Number.isFinite(cam.heading)
            ? cam.heading
            : 0;
        const p =
          typeof cam.pitch === 'number' && Number.isFinite(cam.pitch) ? cam.pitch : pitch;

        if (Platform.OS === 'android') {
          let z =
            typeof cam.zoom === 'number' && Number.isFinite(cam.zoom) ? cam.zoom : 14;
          z +=
            direction === 'in'
              ? MAP_ZOOM_STEP_ANDROID
              : -MAP_ZOOM_STEP_ANDROID;
          z = Math.min(
            MAP_ZOOM_MAX_ANDROID,
            Math.max(MAP_ZOOM_MIN_ANDROID, z),
          );
          map.animateCamera(
            { center, heading, pitch: p, zoom: z },
            { duration: 240 },
          );
          return;
        }

        let alt =
          typeof cam.altitude === 'number' &&
          Number.isFinite(cam.altitude) &&
          cam.altitude > 0
            ? cam.altitude
            : 12_000;
        const factor = iosMapAltitudeZoomFactor(alt);
        alt = direction === 'in' ? alt / factor : alt * factor;
        alt = Math.min(
          IOS_MAP_ALTITUDE_MAX_M,
          Math.max(IOS_MAP_ALTITUDE_MIN_M, alt),
        );
        map.animateCamera(
          { center, heading, pitch: p, altitude: alt },
          { duration: 240 },
        );
      };

      map
        .getCamera()
        .then(apply)
        .catch((err: unknown) => {
          logError(err, { context: 'DiscoverScreen.nudgeMapZoom.getCamera' });
          apply({
            center: {
              latitude: viewportCenter.lat,
              longitude: viewportCenter.lng,
            },
            heading: 0,
            pitch,
            zoom: 14,
            altitude: 12_000,
          });
        });
    },
    [map3DEnabled, mapViewPrefsHydrated, viewportCenter.lat, viewportCenter.lng],
  );

  const searchThisArea = useCallback(() => {
    setFollowingUser(false);
    setMapExploredByGesture(false);
    const next = { lat: viewportCenter.lat, lng: viewportCenter.lng };
    setCenter(next);
    setViewportCenter(next);
    setRegionLabel(null);
    setGeoLabel(null);
    void fetchLocationReverse(env, next.lat, next.lng)
      .then((label) => {
        const trimmed = label.trim();
        if (trimmed.length > 0) {
          setGeoLabel(trimmed);
          void persistProfileCity(trimmed);
        }
      })
      .catch((err: unknown) =>
        logError(err, { context: 'DiscoverScreen.searchThisArea.reverse' }),
      );
    refetch().catch((err) =>
      logError(err, { context: 'DiscoverScreen.searchThisArea.refetch' }),
    );
  }, [
    env,
    persistProfileCity,
    refetch,
    viewportCenter.lat,
    viewportCenter.lng,
  ]);

  /** Count chip tap: frame every pin, or pull fresh results when none in view. */
  const frameAllRescues = useCallback(() => {
    if (discoverMapMarkers.length === 0) {
      searchThisArea();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFollowingUser(false);
    frameRescuePins(true);
  }, [discoverMapMarkers.length, frameRescuePins, searchThisArea]);

  /** Map block entry: a quiet rise + fade once prefs hydrate and it mounts. */
  useEffect(() => {
    if (!mapViewPrefsHydrated) return;
    Animated.timing(mapIntro, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mapIntro, mapViewPrefsHydrated]);

  const mapIntroStyle = useMemo(
    () => ({
      opacity: mapIntro,
      transform: [
        {
          translateY: mapIntro.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 0],
          }),
        },
      ],
    }),
    [mapIntro],
  );

  const viewportDriftKm = useMemo(
    () =>
      haversineKm(
        viewportCenter.lat,
        viewportCenter.lng,
        center.lat,
        center.lng,
      ),
    [viewportCenter.lat, viewportCenter.lng, center.lat, center.lng],
  );
  const showSearchAreaCta =
    mapExploredByGesture &&
    Number.isFinite(viewportDriftKm) &&
    viewportDriftKm >= SEARCH_AREA_KM_THRESHOLD;

  const movingFast =
    !simulatorLocationMode &&
    typeof userLocation.speed === 'number' &&
    userLocation.speed >= SPEED_THRESHOLDS.cyclingMaxMs;

  const updatedLabel = formatUpdatedAgo(userLocation.timestamp, tick);
  const showPermissionBanner =
    locationStatus === 'denied' || locationStatus === 'unavailable';

  const runPlaceSearch = useCallback(async () => {
    const q = placeSearchQuery.trim();
    if (!q) {
      setPlaceSuggestions([]);
      return;
    }
    setPlaceSearchBusy(true);
    setPlaceSearchErr(null);
    try {
      const { results, apiBaseUrlMissing } = await fetchLocationSearch(env, q);
      setPlaceSuggestions(results);
      if (!results.length) {
        setPlaceSearchErr(
          apiBaseUrlMissing
            ? 'Set API_BASE_URL in .env for live search, or try "Colombo 07".'
            : 'No places found — try a neighbourhood or "Colombo 07".',
        );
      }
    } catch {
      setPlaceSearchErr('Search failed — try again or pick a suggestion below.');
      setPlaceSuggestions([]);
    } finally {
      setPlaceSearchBusy(false);
    }
  }, [env, placeSearchQuery]);

  useEffect(() => {
    if (locationSheetMode !== 'place' || !locationSheetOpen) return;
    const q = placeSearchQuery.trim();
    if (q.length < 2) {
      setPlaceSuggestions([]);
      setPlaceSearchErr(q.length === 0 ? null : 'Type at least 2 characters');
      return;
    }
    const timer = setTimeout(() => {
      void runPlaceSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    locationSheetMode,
    locationSheetOpen,
    placeSearchQuery,
    runPlaceSearch,
  ]);

  const submitBagSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    navigation.getParent()?.navigate('SearchResults', {
      chip: selectedChip === 'all' ? undefined : selectedChip,
      query: q,
      lat: center.lat,
      lng: center.lng,
    });
  }, [navigation, searchQuery, selectedChip]);

  const applyPlaceHit = useCallback(
    (hit: LocationHit) => {
      setFollowingUser(false);
      setCenter({ lat: hit.lat, lng: hit.lng });
      setViewportCenter({ lat: hit.lat, lng: hit.lng });
      setRegionLabel(hit.label);
      setGeoLabel(null);
      setPlaceSuggestions([]);
      setPlaceSearchQuery('');
      closeLocationSheet();
      void persistProfileCity(hit.label);
      void refetch();
      mapRef.current?.animateCamera(
        discoverMapAnimateCamera(
          { lat: hit.lat, lng: hit.lng },
          map3DEnabled ? PITCHED_CAMERA_DEGREES : FLAT_CAMERA_DEGREES,
          13,
        ),
        { duration: 450 },
      );
    },
    [closeLocationSheet, map3DEnabled, persistProfileCity, refetch],
  );

  const discoverTopChrome = (
    <>
      <Pressable onPress={openLocationSheet} style={styles.locBlock}>
        <View style={styles.locMainRow}>
          <View style={styles.locIconWrap}>
            <StitchIcon name="location_on" size={22} colorKey="primaryContainer" />
          </View>
          <View style={styles.locCopy}>
            <StitchText variant="label-caps" colorKey="textMuted">
              Current location
            </StitchText>
            <View style={styles.locTitleRow}>
              <StitchText
                variant="h3"
                colorKey="text"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={styles.locTitle}
              >
                {locationShortLabel}
              </StitchText>
              <StitchIcon name="expand_more" size={18} colorKey="text" />
            </View>
          </View>
        </View>
        {locationStatus === 'granted' ? (
          <View style={styles.updatedChipRow}>
            <View style={styles.updatedChip}>
              <View
                style={[
                  styles.updatedDot,
                  {
                    backgroundColor: isUsingFallback
                      ? colors.outline
                      : colors.accent,
                  },
                ]}
              />
              <StitchText
                variant="body-sm"
                colorKey="textMuted"
                numberOfLines={1}
              >
                {updatedLabel}
              </StitchText>
            </View>
          </View>
        ) : null}
      </Pressable>

      {showPermissionBanner ? (
        <StitchSurface elevated padding="md" style={styles.permissionCard}>
          <View style={styles.permissionRow}>
            <StitchIcon
              name="my_location"
              size={22}
              colorKey="primaryContainer"
            />
            <View style={styles.permissionCopy}>
              <StitchText variant="label" colorKey="text">
                See rescue bags around you
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {locationStatus === 'unavailable'
                  ? 'Location services are off. Turn them on in Settings to find nearby rescue bags.'
                  : 'Allow location so we can show outlets that are actually close.'}
              </StitchText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={styles.permissionBtn}
          >
            <StitchText variant="label" colorKey="onPrimary">
              Use my location
            </StitchText>
          </Pressable>
        </StitchSurface>
      ) : null}

      <View style={styles.searchShell}>
        <View style={styles.searchIconWrap} pointerEvents="none">
          <StitchIcon name="search" size={22} colorKey="outline" />
        </View>
        <TextInput
          ref={searchRef}
          testID="discover.searchInput"
          placeholder="Search for fresh rescue bags…"
          placeholderTextColor={colors.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          onSubmitEditing={submitBagSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {DISCOVER_CHIPS.map((chip) => {
          const active = chip.id === selectedChip;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setSelectedChip(chip.id)}
              style={[
                styles.catChip,
                active ? styles.catChipActive : styles.catChipIdle,
              ]}
            >
              <StitchIcon
                name={chip.icon}
                size={18}
                colorKey={active ? 'onPrimary' : 'onSurface'}
              />
              <StitchText
                variant="label"
                colorKey={active ? 'onPrimary' : 'text'}
              >
                {chip.label}
              </StitchText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: includeSoldOut }}
          onPress={() => setIncludeSoldOut((v) => !v)}
          style={[
            styles.catChip,
            includeSoldOut ? styles.catChipActive : styles.catChipIdle,
          ]}
        >
          <StitchIcon
            name={includeSoldOut ? 'check' : 'remove_shopping_cart'}
            size={18}
            colorKey={includeSoldOut ? 'onPrimary' : 'onSurface'}
          />
          <StitchText
            variant="label"
            colorKey={includeSoldOut ? 'onPrimary' : 'text'}
          >
            Include sold out
          </StitchText>
        </Pressable>
      </ScrollView>
    </>
  );

  const discoverMapBlock = (
    <View style={styles.mapWrap}>
      {mapViewPrefsHydrated ? (
        <Animated.View style={[styles.mapInner, mapIntroStyle]}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            mapType={discoverMapType}
            zoomEnabled
            rotateEnabled
            /**
             * Map-first touch zone: one-finger pan, pinch, rotate and pitch all
             * belong to the map now. The Discover page still scrolls naturally
             * from the chrome above and the feed below — the map is no longer
             * a dead rectangle you can only look at.
             */
            scrollEnabled
            initialCamera={initialCamera}
            /**
             * `customMapStyle` only affects the Google Maps provider (Android, or
             * iOS with `PROVIDER_GOOGLE`) — on iOS with `PROVIDER_DEFAULT` (Apple
             * Maps) it's ignored. We instead pass `userInterfaceStyle` so Apple
             * Maps re-renders in the matching scheme regardless of the OS-level
             * appearance.
             */
            customMapStyle={customMapStyle}
            userInterfaceStyle={colorScheme}
            /**
             * The native blue dot lags in nested maps / simulators; the pulsing
             * `UserLocationPulse` marker below mirrors `useUserLocation` instead.
             * Apple POI pins are hidden so rescue pins are the only food story
             * on the surface.
             */
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsBuildings={map3DEnabled}
            showsPointsOfInterests={false}
            pitchEnabled={map3DEnabled}
            toolbarEnabled={false}
            onMapReady={onMapReady}
            onPress={deselectRescueMarker}
            onPanDrag={onMapPanDrag}
            onRegionChangeComplete={handleRegionChangeComplete}
          >
            {discoverMapMarkers.map((marker, index) => (
              <RescueMarker
                key={marker.markerKey}
                marker={marker}
                index={index}
                selected={marker.markerKey === selectedMarkerKey}
                onPress={() => onRescueMarkerPress(marker)}
              />
            ))}
            {hasLiveUserLocation ? (
              <UserLocationPulse
                coordinate={{
                  latitude: userLocation.lat,
                  longitude: userLocation.lng,
                }}
                color={colors.primaryContainer}
              />
            ) : null}
          </MapView>

          {movingFast ? (
            <View style={styles.mapTopBanner}>
              <StitchIcon
                name="directions_car"
                size={18}
                colorKey="primaryContainer"
              />
              <StitchText
                variant="body-sm"
                colorKey="text"
                style={styles.mapTopBannerTxt}
                numberOfLines={2}
              >
                You're moving — auto-refresh paused. Pull down or tap below to update.
              </StitchText>
            </View>
          ) : (
            <>
              <RescueCountChip
                count={discoverMapMarkers.length}
                onPress={frameAllRescues}
              />
              {showSearchAreaCta ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={searchThisArea}
                  style={styles.searchAreaBtn}
                >
                  <StitchIcon name="refresh" size={16} colorKey="onPrimary" />
                  <StitchText variant="label" colorKey="onPrimary">
                    Search this area
                  </StitchText>
                </Pressable>
              ) : null}
            </>
          )}

          <MapControlRail
            showRecenter={locationStatus === 'granted'}
            followingUser={followingUser}
            map3DEnabled={map3DEnabled}
            onRecenter={recenterOnUser}
            onToggle3D={toggleMap3D}
            onZoomIn={() => nudgeDiscoverMapZoom('in')}
            onZoomOut={() => nudgeDiscoverMapZoom('out')}
          />

          <SelectedRescuePreview
            marker={selectedRescueMarker}
            onOpen={openRescueFromPreview}
            onDismiss={deselectRescueMarker}
          />
        </Animated.View>
      ) : (
        <View style={styles.mapPlaceholder} accessibilityLabel="Loading map preferences">
          <ActivityIndicator size="small" color={colors.primaryContainer} />
        </View>
      )}
    </View>
  );

  const feedListHeader = (
    <>
      {discoverTopChrome}
      {discoverMapBlock}
      {error && !showGuestFeedSignIn ? (
        <View style={[styles.banner, styles.bannerErr]}>
          <StitchText variant="body-md" colorKey="onSurface" style={styles.bannerTxt}>
            {error}
          </StitchText>
          <Pressable
            onPress={() => {
              refetch().catch((err) =>
                logError(err, { context: 'DiscoverScreen.retry' }),
              );
            }}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Retry
            </StitchText>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.listHdrBlock}>
        <View style={{ flex: 1 }}>
          <StitchText variant="h2" colorKey="text">
            Rescue near you
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Save food and money from local spots.
          </StitchText>
        </View>
        <Pressable
          onPress={() =>
            navigation
              .getParent()
              ?.navigate('SearchResults', {
                chip: selectedChip === 'all' ? undefined : selectedChip,
                query: searchQuery.trim() || undefined,
                lat: center.lat,
                lng: center.lng,
              })
          }
          accessibilityRole="button"
        >
          <StitchText variant="label" colorKey="primaryContainer">
            See all
          </StitchText>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={styles.flex}>
      {forcedCopy ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {discoverTopChrome}
          <StitchSurface elevated padding="md" style={styles.forcedBox}>
            <StitchText variant="h3" colorKey="primary" testID="discover.forcedEmptyTitle">
              {forcedCopy.title}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={styles.forcedBody}>
              {forcedCopy.body}
            </StitchText>
          </StitchSurface>
          {discoverMapBlock}
          {loading && forcedCopy ? (
            <View style={styles.banner}>
              <ActivityIndicator color={colors.primaryContainer} />
              <StitchText variant="body-md" colorKey="onSurface" style={styles.bannerTxt}>
                Loading bags…
              </StitchText>
            </View>
          ) : null}
          {error && !showGuestFeedSignIn ? (
            <View style={[styles.banner, styles.bannerErr]}>
              <StitchText variant="body-md" colorKey="onSurface" style={styles.bannerTxt}>
                {error}
              </StitchText>
              <Pressable
                onPress={() => {
                  refetch().catch((err) =>
                    logError(err, { context: 'DiscoverScreen.retry' }),
                  );
                }}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  Retry
                </StitchText>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          ref={feedListRef}
          data={loading ? [] : listFeed}
          style={styles.list}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          onScrollToIndexFailed={(info) => {
            feedListRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: true,
            });
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onPullRefresh()}
              tintColor={colors.primaryContainer}
            />
          }
          ListHeaderComponent={feedListHeader}
          ListEmptyComponent={
            loading ? (
              <View style={[styles.listRowGutter, { paddingTop: spacing.sm }]}>
                <DiscoverSkeletonBlock colors={colors} spacing={spacing} radii={radii} />
              </View>
            ) : (
              <View style={[styles.listRowGutter, { marginTop: spacing.sm }]}>
                <StitchSurface elevated padding="lg">
                  <StitchText
                    variant="h3"
                    colorKey="text"
                    testID={
                      listEmptyCopy.kind === 'guest-sign-in'
                        ? 'discover.guestSignInTitle'
                        : undefined
                    }
                  >
                    {listEmptyCopy.title}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 8 }}>
                    {listEmptyCopy.body}
                  </StitchText>
                  {listEmptyCopy.kind === 'guest-sign-in' ? (
                    <Pressable
                      accessibilityRole="button"
                      testID="discover.guestSignInCta"
                      onPress={() => navigation.getParent()?.navigate('Login')}
                      style={[styles.permissionBtn, { marginTop: spacing.md, alignSelf: 'flex-start' }]}
                    >
                      <StitchText variant="label" colorKey="onPrimary">
                        Sign in
                      </StitchText>
                    </Pressable>
                  ) : null}
                </StitchSurface>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.listRowGutter}>
              {item.kind === 'shelf' && isClearanceShelvesEnabled() ? (
                <DiscoverShelfCard
                  item={item}
                  onOpen={openShelf}
                  onOpenOutlet={openOutlet}
                  colors={colors}
                  spacing={spacing}
                  radii={radii}
                />
              ) : item.kind === 'bag' ? (
                <DiscoverBagCard
                  bag={item as unknown as DiscoverBag}
                  onOpen={openBag}
                  onOpenOutlet={openOutlet}
                  colors={colors}
                  spacing={spacing}
                  radii={radii}
                />
              ) : null}
            </View>
          )}
        />
      )}

      <Modal
        visible={locationSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={closeLocationSheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.locationSheetRoot}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 8 : 0}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss location options"
            style={styles.locationSheetBackdrop}
            onPress={closeLocationSheet}
          />
          <StitchSurface
            elevated
            padding="none"
            style={[
              styles.locationSheetCard,
              {
                marginBottom: Math.max(insets.bottom, spacing.lg),
                maxHeight: Math.round(windowHeight * 0.7),
              },
            ]}
          >
            <View style={{ padding: spacing.md, gap: spacing.xs }}>
              <StitchText variant="h3" colorKey="text">
                {locationSheetMode === 'place' ? 'Search place' : 'Location & map'}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {locationSheetMode === 'place'
                  ? locationDisplayLabel
                  : 'Choose how to set the area for rescue bags and the map.'}
              </StitchText>
            </View>
            {locationSheetMode === 'place' ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.sm,
                  gap: spacing.sm,
                }}
                style={{ flexGrow: 0 }}
              >
                <View style={styles.searchShell}>
                  <View style={styles.searchIconWrap} pointerEvents="none">
                    <StitchIcon name="search" size={22} colorKey="outline" />
                  </View>
                  <TextInput
                    ref={placeSearchRef}
                    placeholder="Neighbourhood or landmark…"
                    placeholderTextColor={colors.textFaint}
                    value={placeSearchQuery}
                    onChangeText={(t) => {
                      setPlaceSearchQuery(t);
                      if (placeSearchErr && t.trim().length >= 2) {
                        setPlaceSearchErr(null);
                      }
                    }}
                    style={styles.searchInput}
                    onSubmitEditing={() => void runPlaceSearch()}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="words"
                    keyboardType="default"
                    editable
                    showSoftInputOnFocus
                  />
                  {placeSearchBusy ? (
                    <View style={styles.searchBusy}>
                      <ActivityIndicator size="small" color={colors.primaryContainer} />
                    </View>
                  ) : null}
                </View>
                {placeSearchErr ? (
                  <StitchText variant="body-sm" colorKey="error">
                    {placeSearchErr}
                  </StitchText>
                ) : null}
                {placeSuggestions.map((item, ix) => (
                  <Pressable
                    key={`${item.lat}-${item.lng}-${ix}`}
                    onPress={() => applyPlaceHit(item)}
                    style={({ pressed }) => [
                      styles.locationSheetRow,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <StitchIcon name="location_on" size={22} colorKey="primaryContainer" />
                    <StitchText variant="body-sm" colorKey="onSurface" style={{ flex: 1 }}>
                      {item.label}
                    </StitchText>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setLocationSheetMode('menu')}
                  style={{ paddingVertical: spacing.sm }}
                >
                  <StitchText variant="label" colorKey="primaryContainer">
                    Back
                  </StitchText>
                </Pressable>
              </ScrollView>
            ) : (
              <>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                closeLocationSheet();
                void recenterOnUser();
              }}
              style={({ pressed }) => [
                styles.locationSheetRow,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <StitchIcon name="my_location" size={22} colorKey="primaryContainer" />
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="text">
                  Use my location
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Recenter map and feed on your GPS position
                </StitchText>
              </View>
            </Pressable>
            <View style={[styles.locationSheetDivider, { backgroundColor: colors.divider }]} />
            <Pressable
              accessibilityRole="button"
              onPress={openPlaceSearchInSheet}
              style={({ pressed }) => [
                styles.locationSheetRow,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <StitchIcon name="search" size={22} colorKey="primaryContainer" />
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="text">
                  Search place
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Find a neighbourhood or landmark
                </StitchText>
              </View>
            </Pressable>
            {showSearchAreaCta && !movingFast ? (
              <>
                <View style={[styles.locationSheetDivider, { backgroundColor: colors.divider }]} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    closeLocationSheet();
                    searchThisArea();
                  }}
                  style={({ pressed }) => [
                    styles.locationSheetRow,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <StitchIcon name="refresh" size={22} colorKey="primaryContainer" />
                  <View style={{ flex: 1 }}>
                    <StitchText variant="label" colorKey="text">
                      Search this map area
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      Load bags for where the map is centred
                    </StitchText>
                  </View>
                </Pressable>
              </>
            ) : null}
              </>
            )}
            {locationSheetMode === 'menu' ? (
            <View style={{ padding: spacing.md, paddingTop: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={closeLocationSheet}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <StitchText variant="label" colorKey="primaryContainer">
                  Close
                </StitchText>
              </Pressable>
            </View>
            ) : null}
          </StitchSurface>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function useDiscoverStyles(
  colors: StitchTheme['colors'],
  spacing: StitchTheme['spacing'],
  radii: StitchTheme['radii'],
  mapHeight: number,
) {
  return useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, backgroundColor: colors.background },
        locBlock: {
          gap: spacing.xs,
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        },
        locMainRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          minWidth: 0,
        },
        locIconWrap: {
          flexShrink: 0,
          paddingTop: 2,
        },
        locCopy: {
          flex: 1,
          minWidth: 0,
        },
        locTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          minWidth: 0,
        },
        locTitle: {
          flex: 1,
          minWidth: 0,
        },
        searchShell: {
          marginHorizontal: spacing.pageMarginMobile,
          marginBottom: spacing.sm,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        },
        searchIconWrap: {
          position: 'absolute',
          left: spacing.md,
          zIndex: 1,
          height: '100%',
          justifyContent: 'center',
        },
        searchInput: {
          flex: 1,
          paddingLeft: 44,
          paddingRight: spacing.md,
          paddingVertical: 12,
          fontFamily: stitchFonts.regular,
          fontSize: 15,
          color: colors.text,
        },
        searchBusy: { paddingRight: spacing.sm },
        searchErr: {
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: 4,
        },
        chipsRow: { maxHeight: 76, marginTop: 4 },
        chipsContent: {
          gap: 8,
          paddingHorizontal: spacing.pageMarginMobile,
        },
        chip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: radii.lg,
          maxWidth: 220,
          marginRight: 2,
          justifyContent: 'center',
        },
        catScroll: { maxHeight: 52, marginBottom: spacing.sm },
        catScrollContent: {
          gap: spacing.sm,
          paddingHorizontal: spacing.pageMarginMobile,
          paddingBottom: spacing.xs,
        },
        catChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
        },
        catChipActive: {
          backgroundColor: colors.primaryContainer,
          ...stitchAmbientShadow,
        },
        catChipIdle: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        forcedBox: {
          marginHorizontal: spacing.pageMarginMobile,
          marginBottom: spacing.sm,
          gap: 4,
        },
        forcedBody: { marginTop: 4 },
        updatedChipRow: {
          paddingLeft: 22 + spacing.sm,
        },
        updatedChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.surfaceContainerLow,
          alignSelf: 'flex-start',
        },
        updatedDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
        },
        permissionCard: {
          marginHorizontal: spacing.pageMarginMobile,
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        permissionRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
        },
        permissionCopy: { flex: 1, gap: 4 },
        permissionBtn: {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderRadius: radii.lg,
          backgroundColor: colors.primaryContainer,
        },
        mapWrap: {
          height: mapHeight,
          position: 'relative',
          marginHorizontal: spacing.pageMarginMobile,
          marginBottom: spacing.sm,
          borderRadius: radii.lg,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.outlineVariant,
          backgroundColor: colors.surfaceContainerLow,
        },
        map: { flex: 1 },
        mapInner: { flex: 1 },
        mapPlaceholder: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: mapHeight - 2,
        },
        mapTopBanner: {
          position: 'absolute',
          top: spacing.sm,
          left: spacing.md,
          right: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          backgroundColor: `${colors.surface}F2`,
          ...stitchAmbientShadow,
        },
        mapTopBannerTxt: { flex: 1 },
        /** "Search this area" — top-right, opposite the rescue count chip. */
        searchAreaBtn: {
          position: 'absolute',
          top: 10,
          right: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.sm,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: colors.primaryContainer,
          ...stitchAmbientShadow,
        },
        list: {
          flex: 1,
          minHeight: 0,
          backgroundColor: colors.background,
        },
        listContent: {
          paddingBottom: spacing.xl,
        },
        listRowGutter: {
          paddingHorizontal: spacing.pageMarginMobile,
        },
        listHdrBlock: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.md,
          paddingHorizontal: spacing.pageMarginMobile,
        },
        banner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          backgroundColor: colors.surfaceContainerLow,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: colors.divider,
        },
        bannerErr: { justifyContent: 'space-between' },
        bannerTxt: { flexShrink: 1 },
        locationSheetRoot: {
          flex: 1,
          justifyContent: 'flex-end',
        },
        locationSheetBackdrop: {
          ...StyleSheet.absoluteFill,
          backgroundColor: colors.scrim,
        },
        locationSheetCard: {
          marginHorizontal: spacing.md,
          marginBottom: spacing.lg,
          borderRadius: radii.xl,
          overflow: 'hidden',
        },
        locationSheetRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
        locationSheetDivider: {
          height: StyleSheet.hairlineWidth,
          marginLeft: spacing.md + 22 + spacing.md,
        },
      }),
    [colors, spacing, radii, mapHeight],
  );
}
