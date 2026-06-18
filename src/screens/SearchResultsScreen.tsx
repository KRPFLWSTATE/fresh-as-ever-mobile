/**
 * SearchResults — paginated bag listing with Stitch filter chips. Reachable from:
 *   • `DiscoverScreen` "See all" CTA (with a `chip` route param mapped to a category)
 *   • Any other "search results" Pressable that doesn't already navigate
 * Deep link: `freshasever://discover/search?chip=bakery&query=loaves`.
 *
 * Behavior:
 *   - Supabase `rescue_bags` with `.range()` pagination, page size 20.
 *   - Filter chips for **Categories**, **Distance**, **Price**, **Pickup window**.
 *   - Tapping a row routes into `BagDetail`.
 *
 * Distance is a heuristic ordering hint only (we don't have a stable lat/lng on the customer
 * side yet); the chip is applied client-side after fetching.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { fetchScopedNearbyBags } from '@/hooks/useNearbyBags';
import { haversineKm } from '@/lib/haversine';
import { featureFlags } from '@/config/featureFlags';
import { pickupBrowseState } from '@/lib/pickupWindowPresets';
import { PickupBrowsePill } from '@/components/PickupBrowsePill';
import { canPublishRescueBags } from '@/lib/outletListingMode';
import {
  discoverCategoryMatchesChip,
  type DiscoverCategoryChipId,
} from '@/lib/discoverCategoryChip';
import { isNeighbourhoodBrowseEnabled } from '@/config/featureFlags';
import {
  distinctLandmarks,
  filterByLandmarks,
  matchesDistanceFilter,
  type DistanceFilterKey,
} from '@/lib/neighbourhoodFilter';
import { formatDiscoverCardSubtitle } from '@/lib/landmarkDisplay';
import {
  getActiveSeasonalWindows,
  listingMatchesOccasionFilter,
  type SeasonalOccasionKind,
} from '@/domain/seasonalOccasion';
import { useSeasonalOccasionWindows } from '@/hooks/useSeasonalOccasionWindows';
import { SeasonalOccasionBadge } from '@/components/SeasonalOccasionBadge';
import { ERROR } from '@/lib/messages/errors';
import { mapSupabaseError } from '@/lib/supabaseError';
import { useStitchTheme, type StitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SearchResults'>;
type R = RouteProp<RootStackParamList, 'SearchResults'>;

const PAGE_SIZE = 20;

const CATEGORY_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'meals', label: 'Meals' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'supermarket', label: 'Supermarket' },
] as const;

const DISTANCE_CHIPS = [
  { key: 'any', label: 'Any distance' },
  { key: 'near', label: '< 3 km' },
  { key: 'wide', label: '< 10 km' },
] as const;

const PRICE_CHIPS = [
  { key: 'any', label: 'Any price' },
  { key: 'under500', label: 'Under Rs 500' },
  { key: 'under1000', label: 'Under Rs 1 000' },
  { key: 'over1000', label: 'Rs 1 000+' },
] as const;

const PICKUP_CHIPS = [
  { key: 'any', label: 'Any time' },
  { key: 'now', label: 'Pickup now' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
] as const;

type CategoryChipKey = DiscoverCategoryChipId;
type DistanceChipKey = DistanceFilterKey;
type PriceChipKey = (typeof PRICE_CHIPS)[number]['key'];
type PickupChipKey = (typeof PICKUP_CHIPS)[number]['key'];

type Row = {
  id: string;
  title: string;
  category: string | null;
  rescue_price: number;
  retail_value_estimate: number | null;
  image_url: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  pickup_window_kind?: string | null;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  outlet_name: string | null;
  outlet_id: string | null;
  outlet_category: string | null;
  landmark: string | null;
  distance_km?: number | null;
  occasion_kind?: string | null;
};

function formatLkr(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `LKR ${v.toLocaleString('en-LK')}`;
}

function formatPickupLine(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const f = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };
  const a = f(start);
  const b = f(end);
  if (!a || !b) return null;
  return `${a} – ${b}`;
}

function bagMatchesCategory(row: Row, chip: CategoryChipKey): boolean {
  return discoverCategoryMatchesChip(row.outlet_category ?? row.category, chip);
}

function priceMatches(row: Row, chip: PriceChipKey): boolean {
  const p = row.rescue_price;
  switch (chip) {
    case 'any':
      return true;
    case 'under500':
      return p < 500;
    case 'under1000':
      return p < 1000;
    case 'over1000':
      return p >= 1000;
  }
}

function pickupMatches(row: Row, chip: PickupChipKey): boolean {
  if (chip === 'any') return true;
  if (!row.pickup_start || !row.pickup_end) return false;
  const start = new Date(row.pickup_start);
  const end = new Date(row.pickup_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const todayKey = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = tomorrow.toDateString();
  switch (chip) {
    case 'now':
      if (featureFlags.PICKUP_WINDOW_PRESETS) {
        const state = pickupBrowseState(nowMs, row.pickup_start, row.pickup_end);
        return state === 'open_now' || state === 'opening_soon';
      }
      return start.getTime() <= nowMs && end.getTime() >= nowMs;
    case 'tonight':
      return start.toDateString() === todayKey && start.getHours() >= 17;
    case 'tomorrow':
      return start.toDateString() === tomorrowKey;
  }
}

function distanceMatches(
  row: Row,
  chip: DistanceChipKey,
  originLat?: number,
  originLng?: number,
): boolean {
  if (chip === 'any') return true;
  const maxKm = chip === 'near' ? 3 : 10;
  if (typeof row.distance_km === 'number' && Number.isFinite(row.distance_km)) {
    return row.distance_km <= maxKm;
  }
  if (
    originLat != null &&
    originLng != null &&
    row.outlet_lat != null &&
    row.outlet_lng != null
  ) {
    const km = haversineKm(originLat, originLng, row.outlet_lat, row.outlet_lng);
    return Number.isFinite(km) && km <= maxKm;
  }
  return true;
}

function mapDiscoverBagToRow(bag: {
  id: string;
  title: string;
  category?: string | null;
  rescue_price: number;
  retail_value_estimate?: number | null;
  image_url?: string | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
  pickup_window_kind?: string | null;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  outlet_name?: string | null;
  outlet_id?: string | null;
  outlet_category?: string | null;
  landmark?: string | null;
  outlet_landmark?: string | null;
  distance_km?: number | null;
  occasion_kind?: string | null;
}): Row {
  return {
    id: bag.id,
    title: bag.title,
    category: bag.category ?? null,
    rescue_price: bag.rescue_price,
    retail_value_estimate: bag.retail_value_estimate ?? null,
    image_url: bag.image_url ?? null,
    pickup_start: bag.pickup_start ?? null,
    pickup_end: bag.pickup_end ?? null,
    pickup_window_kind: bag.pickup_window_kind ?? null,
    outlet_lat: bag.outlet_lat ?? null,
    outlet_lng: bag.outlet_lng ?? null,
    outlet_name: bag.outlet_name ?? null,
    outlet_id: bag.outlet_id ?? null,
    outlet_category: bag.outlet_category ?? null,
    landmark: bag.landmark ?? bag.outlet_landmark ?? null,
    distance_km: bag.distance_km ?? null,
    occasion_kind: bag.occasion_kind ?? null,
  };
}

function mapRow(raw: Record<string, unknown>): Row {
  const outlet = raw.outlet as Record<string, unknown> | undefined;
  const retailRaw = raw.retail_value_estimate;
  const retail =
    typeof retailRaw === 'number'
      ? retailRaw
      : retailRaw != null
        ? Number(retailRaw)
        : NaN;
  return {
    id: String(raw.id),
    title: String(raw.title ?? 'Bag'),
    category: raw.category != null ? String(raw.category) : null,
    rescue_price: Number(raw.rescue_price ?? 0),
    retail_value_estimate: Number.isFinite(retail) ? retail : null,
    image_url: raw.image_url != null ? String(raw.image_url) : null,
    pickup_start:
      typeof raw.pickup_start === 'string' ? raw.pickup_start : null,
    pickup_end:
      typeof raw.pickup_end === 'string' ? raw.pickup_end : null,
    pickup_window_kind:
      raw.pickup_window_kind != null ? String(raw.pickup_window_kind) : null,
    outlet_name: outlet?.name != null ? String(outlet.name) : null,
    outlet_id: outlet?.id != null ? String(outlet.id) : null,
    outlet_category: outlet?.category != null ? String(outlet.category) : null,
    landmark: outlet?.landmark != null ? String(outlet.landmark) : null,
    outlet_lat: null,
    outlet_lng: null,
    distance_km: null,
    occasion_kind:
      raw.occasion_kind != null ? String(raw.occasion_kind) : null,
  };
}

export function SearchResultsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(() => createStyles({ colors, spacing, radii }), [colors, spacing, radii]);

  const initialChipRaw = route.params?.chip;
  const initialChip: CategoryChipKey = useMemo(() => {
    if (!initialChipRaw) return 'all';
    const lower = String(initialChipRaw).toLowerCase();
    const match = CATEGORY_CHIPS.find((c) => c.key === lower);
    return match ? match.key : 'all';
  }, [initialChipRaw]);

  const [category, setCategory] = useState<CategoryChipKey>(initialChip);
  const [distance, setDistance] = useState<DistanceChipKey>('any');
  const [selectedNeighbourhoods, setSelectedNeighbourhoods] = useState<string[]>([]);
  const [price, setPrice] = useState<PriceChipKey>('any');
  const [pickup, setPickup] = useState<PickupChipKey>('any');
  const [selectedOccasion, setSelectedOccasion] = useState<SeasonalOccasionKind | 'all'>('all');
  const [query, setQuery] = useState<string>(route.params?.query ?? '');

  const neighbourhoodBrowseEnabled = isNeighbourhoodBrowseEnabled();
  const { windows: seasonalWindows } = useSeasonalOccasionWindows(env);
  const seasonalBadgesEnabled = featureFlags.SEASONAL_BADGES;
  const activeSeasonalWindows = useMemo(
    () => (seasonalBadgesEnabled ? getActiveSeasonalWindows(seasonalWindows) : []),
    [seasonalBadgesEnabled, seasonalWindows],
  );

  const scopedLat = route.params?.lat;
  const scopedLng = route.params?.lng;
  const hasGeoScope =
    typeof scopedLat === 'number' &&
    Number.isFinite(scopedLat) &&
    typeof scopedLng === 'number' &&
    Number.isFinite(scopedLng);

  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      setLoading(true);
      setError(null);
      const sb = getSupabase(env);

      if (hasGeoScope && nextPage === 0) {
        try {
          const nearby = await fetchScopedNearbyBags(sb, scopedLat!, scopedLng!);
          const mapped = nearby
            .map(mapDiscoverBagToRow)
            .filter((row) => canPublishRescueBags(row.outlet_category));
          setRows(mapped);
          setHasMore(false);
          setPage(0);
        } catch (e) {
          setError(mapSupabaseError(e as Error, ERROR.discover.loadBags));
          if (reset) setRows([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let req = sb
        .from('rescue_bags')
        .select(
          `
          id,
          title,
          category,
          rescue_price,
          retail_value_estimate,
          pickup_start,
          pickup_end,
          pickup_window_kind,
          image_url,
          quantity_remaining,
          occasion_kind,
          status,
          outlet:outlets ( id, name, category, landmark, location )
        `,
          { count: 'exact' },
        )
        .eq('status', 'live')
        .gt('quantity_remaining', 0)
        .order('created_at', { ascending: false })
        .range(from, to);

      const q = query.trim();
      if (q.length > 0) {
        req = req.ilike('title', `%${q}%`);
      }

      const { data, error: e } = await req;
      if (e) {
        setError(mapSupabaseError(e as Error, ERROR.discover.loadBags));
        if (reset) setRows([]);
        setLoading(false);
        return;
      }
      const mapped = ((data ?? []) as Record<string, unknown>[])
        .map(mapRow)
        .filter(
          (row) =>
            canPublishRescueBags(row.outlet_category),
        );
      setRows((prev) => (reset ? mapped : [...prev, ...mapped]));
      setHasMore(mapped.length === PAGE_SIZE);
      setPage(nextPage);
      setLoading(false);
    },
    [env, hasGeoScope, query, scopedLat, scopedLng],
  );

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage]);

  const neighbourhoodOptions = useMemo(
    () => (neighbourhoodBrowseEnabled ? distinctLandmarks(rows) : []),
    [neighbourhoodBrowseEnabled, rows],
  );

  const filteredRows = useMemo(
    () =>
      filterByLandmarks(
        rows
          .filter((r) => bagMatchesCategory(r, category))
          .filter((r) => priceMatches(r, price))
          .filter((r) => pickupMatches(r, pickup))
          .filter((r) =>
            matchesDistanceFilter(r, distance, scopedLat, scopedLng),
          )
          .filter((r) => listingMatchesOccasionFilter(r.occasion_kind, selectedOccasion)),
        selectedNeighbourhoods,
      ),
    [rows, category, price, pickup, distance, scopedLat, scopedLng, selectedNeighbourhoods, selectedOccasion],
  );

  const toggleNeighbourhood = useCallback((landmark: string) => {
    setSelectedNeighbourhoods((prev) => {
      const norm = landmark.toLowerCase();
      const has = prev.some((l) => l.toLowerCase() === norm);
      if (has) return prev.filter((l) => l.toLowerCase() !== norm);
      return [...prev, landmark];
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      const pickupLine = formatPickupLine(item.pickup_start, item.pickup_end);
      const retail = item.retail_value_estimate;
      const showStrike =
        typeof retail === 'number' && retail > item.rescue_price;
      const outletSubtitle = formatDiscoverCardSubtitle(
        item.outlet_name,
        item.landmark,
        neighbourhoodBrowseEnabled,
      );
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('BagDetail', { id: item.id })}
          style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
        >
          <StitchSurface elevated padding="none" style={styles.card}>
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.thumbWrap}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.thumb}
                    resizeMode="cover"
                    accessibilityLabel={`${item.title} preview`}
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <StitchIcon name="shopping_bag" size={28} colorKey="textMuted" />
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                {item.category ? (
                  <View style={styles.categoryPill}>
                    <StitchText
                      variant="body-sm"
                      colorKey="primaryActive"
                      style={{ fontFamily: stitchFonts.semiBold }}
                    >
                      {item.category}
                    </StitchText>
                  </View>
                ) : null}
                <StitchText variant="h3" colorKey="text" numberOfLines={2} style={{ marginTop: 4 }}>
                  {item.title}
                </StitchText>
                {seasonalBadgesEnabled ? (
                  <View style={{ marginTop: 4 }}>
                    <SeasonalOccasionBadge
                      occasionKind={item.occasion_kind}
                      windows={seasonalWindows}
                      featureEnabled={seasonalBadgesEnabled}
                      compact
                    />
                  </View>
                ) : null}
                {item.outlet_id ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${outletSubtitle} profile`}
                    onPress={() =>
                      navigation.navigate('OutletDetail', {
                        outletId: item.outlet_id as string,
                      })
                    }
                    hitSlop={6}
                  >
                    <StitchText
                      variant="body-sm"
                      colorKey="textMuted"
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {outletSubtitle}
                    </StitchText>
                  </Pressable>
                ) : (
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    numberOfLines={1}
                    style={{ marginTop: 2 }}
                  >
                    {outletSubtitle}
                  </StitchText>
                )}
                {featureFlags.PICKUP_WINDOW_PRESETS ? (
                  <PickupBrowsePill
                    pickupStart={item.pickup_start}
                    pickupEnd={item.pickup_end}
                    pickupWindowKind={item.pickup_window_kind}
                  />
                ) : pickupLine ? (
                  <View style={styles.pickupRow}>
                    <StitchIcon name="schedule" size={16} colorKey="textMuted" />
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {pickupLine}
                    </StitchText>
                  </View>
                ) : null}
                <View style={styles.priceRow}>
                  <View>
                    {showStrike ? (
                      <StitchText variant="price-original" colorKey="textMuted">
                        {formatLkr(retail!)}
                      </StitchText>
                    ) : null}
                    <StitchText variant="price" colorKey="accent">
                      {formatLkr(item.rescue_price)}
                    </StitchText>
                  </View>
                  <View style={styles.reserveChip}>
                    <StitchText variant="label" colorKey="onPrimary">
                      Reserve
                    </StitchText>
                  </View>
                </View>
              </View>
            </View>
          </StitchSurface>
        </Pressable>
      );
    },
    [navigation, neighbourhoodBrowseEnabled, seasonalBadgesEnabled, seasonalWindows, styles],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.pageHeader}>
          <StitchText variant="h1" colorKey="text">
            Search results
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            {hasGeoScope
              ? 'Rescue bags near your selected area.'
              : 'Filter by category, distance, price, and pickup window.'}
          </StitchText>
        </View>

        <View style={styles.searchShell}>
          <View style={styles.searchIcon} pointerEvents="none">
            <StitchIcon name="search" size={22} colorKey="outline" />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search rescue bags…"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              void fetchPage(0, true);
            }}
          />
        </View>

        <FilterChipBar
          label="Categories"
          items={CATEGORY_CHIPS}
          value={category}
          onSelect={(v) => setCategory(v as CategoryChipKey)}
        />
        <FilterChipBar
          label="Distance"
          items={DISTANCE_CHIPS}
          value={distance}
          onSelect={(v) => setDistance(v as DistanceChipKey)}
        />
        {neighbourhoodBrowseEnabled && neighbourhoodOptions.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.pageMarginMobile, marginBottom: spacing.xs }}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
              Neighbourhood
            </StitchText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {neighbourhoodOptions.map((landmark) => {
                const on = selectedNeighbourhoods.some(
                  (l) => l.toLowerCase() === landmark.toLowerCase(),
                );
                return (
                  <Pressable
                    key={landmark}
                    testID={`search.neighbourhood.${landmark.replace(/\s+/g, '_')}`}
                    onPress={() => toggleNeighbourhood(landmark)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm - 2,
                      borderRadius: radii.full,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.outlineVariant,
                      backgroundColor: on ? colors.primaryHighlight : colors.surface,
                    }}
                  >
                    <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'text'}>
                      {landmark}
                    </StitchText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {seasonalBadgesEnabled && activeSeasonalWindows.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.pageMarginMobile, marginBottom: spacing.xs }}>
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
              Season
            </StitchText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {activeSeasonalWindows.map((window) => {
                const on = selectedOccasion === window.occasion;
                return (
                  <Pressable
                    key={window.occasion}
                    testID={`search.occasion.${window.occasion}`}
                    onPress={() =>
                      setSelectedOccasion((prev) =>
                        prev === window.occasion ? 'all' : window.occasion,
                      )
                    }
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm - 2,
                      borderRadius: radii.full,
                      borderWidth: 1,
                      borderColor: on ? colors.primary : colors.outlineVariant,
                      backgroundColor: on ? colors.primaryHighlight : colors.surface,
                    }}
                  >
                    <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'text'}>
                      {window.label}
                    </StitchText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <FilterChipBar
          label="Price"
          items={PRICE_CHIPS}
          value={price}
          onSelect={(v) => setPrice(v as PriceChipKey)}
        />
        <FilterChipBar
          label="Pickup window"
          items={PICKUP_CHIPS}
          value={pickup}
          onSelect={(v) => setPickup(v as PickupChipKey)}
        />

        {error ? (
          <View style={styles.errorRow}>
            <StitchText variant="body-sm" colorKey="error">
              {error}
            </StitchText>
          </View>
        ) : null}
      </>
    ),
    [
      activeSeasonalWindows,
      category,
      colors.outlineVariant,
      colors.primary,
      colors.primaryHighlight,
      colors.surface,
      colors.textFaint,
      distance,
      error,
      fetchPage,
      hasGeoScope,
      neighbourhoodBrowseEnabled,
      neighbourhoodOptions,
      pickup,
      price,
      query,
      radii.full,
      selectedNeighbourhoods,
      selectedOccasion,
      seasonalBadgesEnabled,
      spacing.md,
      spacing.pageMarginMobile,
      spacing.sm,
      spacing.xs,
      styles.errorRow,
      styles.pageHeader,
      styles.searchIcon,
      styles.searchInput,
      styles.searchShell,
      toggleNeighbourhood,
    ],
  );

  return (
    <StitchScreen edges={['top', 'left', 'right']} style={styles.screen}>
      <FlatList
        style={styles.list}
        data={filteredRows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!hasGeoScope && !loading && hasMore && rows.length > 0) {
            void fetchPage(page + 1, false);
          }
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? null : (
            <StitchSurface elevated padding="md" style={styles.emptyCard}>
              <StitchText variant="h3" colorKey="text">
                No matches
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Try widening the filters or clearing the search term.
              </StitchText>
            </StitchSurface>
          )
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator color={colors.primaryContainer} />
            </View>
          ) : null
        }
      />
    </StitchScreen>
  );
}

function FilterChipBar(props: {
  label: string;
  items: readonly { key: string; label: string }[];
  value: string;
  onSelect: (key: string) => void;
}): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  return (
    <View style={{ paddingHorizontal: spacing.pageMarginMobile, marginBottom: spacing.xs }}>
      <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
        {props.label}
      </StitchText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {props.items.map((it) => {
          const on = props.value === it.key;
          return (
            <Pressable
              key={it.key}
              onPress={() => props.onSelect(it.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm - 2,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.outlineVariant,
                backgroundColor: on ? colors.primaryHighlight : colors.surface,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'text'}>
                {it.label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(props: {
  colors: StitchTheme['colors'];
  spacing: StitchTheme['spacing'];
  radii: StitchTheme['radii'];
}) {
  const { colors, spacing, radii } = props;
  const cardBorder: ViewStyle = {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  };
  return StyleSheet.create({
    screen: { flex: 1 },
    list: { flex: 1 },
    pageHeader: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
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
    },
    searchIcon: {
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
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    errorRow: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingVertical: spacing.xs,
    },
    listContent: {
      paddingHorizontal: spacing.pageMarginMobile,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    card: {
      ...cardBorder,
      backgroundColor: colors.surface,
    },
    thumbWrap: {
      width: 120,
      height: 120,
    },
    thumb: { width: 120, height: 120 },
    thumbFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface2,
    },
    cardBody: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 2,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.default,
      backgroundColor: colors.primaryHighlight,
    },
    pickupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 6,
    },
    reserveChip: {
      backgroundColor: colors.surfaceTint,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radii.lg,
    },
    emptyCard: {
      marginHorizontal: 0,
      marginTop: spacing.md,
    },
    loadingFooter: { paddingVertical: spacing.md, alignItems: 'center' },
  });
}
