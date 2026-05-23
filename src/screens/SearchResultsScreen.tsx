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

type CategoryChipKey = (typeof CATEGORY_CHIPS)[number]['key'];
type DistanceChipKey = (typeof DISTANCE_CHIPS)[number]['key'];
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
  outlet_name: string | null;
  outlet_id: string | null;
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
  if (chip === 'all') return true;
  const c = (row.category ?? '').toLowerCase();
  if (!c) return false;
  switch (chip) {
    case 'bakery':
      return c.includes('bake') || c.includes('pastry');
    case 'cafe':
      return c.includes('cafe') || c.includes('coffee');
    case 'meals':
      return (
        c.includes('meal') ||
        c.includes('lunch') ||
        c.includes('dinner') ||
        c.includes('food')
      );
    case 'groceries':
      return c.includes('groc') || c.includes('veg') || c.includes('produce');
    case 'supermarket':
      return c.includes('super') || c.includes('market');
    default:
      return false;
  }
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
  const now = new Date();
  const todayKey = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = tomorrow.toDateString();
  switch (chip) {
    case 'now':
      return start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
    case 'tonight':
      return start.toDateString() === todayKey && start.getHours() >= 17;
    case 'tomorrow':
      return start.toDateString() === tomorrowKey;
  }
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
    outlet_name: outlet?.name != null ? String(outlet.name) : null,
    outlet_id: outlet?.id != null ? String(outlet.id) : null,
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
  const [price, setPrice] = useState<PriceChipKey>('any');
  const [pickup, setPickup] = useState<PickupChipKey>('any');
  const [query, setQuery] = useState<string>(route.params?.query ?? '');

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
          image_url,
          quantity_remaining,
          status,
          outlet:outlets ( id, name )
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
      const mapped = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
      setRows((prev) => (reset ? mapped : [...prev, ...mapped]));
      setHasMore(mapped.length === PAGE_SIZE);
      setPage(nextPage);
      setLoading(false);
    },
    [env, query],
  );

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage]);

  const filteredRows = useMemo(
    () =>
      rows
        .filter((r) => bagMatchesCategory(r, category))
        .filter((r) => priceMatches(r, price))
        .filter((r) => pickupMatches(r, pickup)),
    [rows, category, price, pickup],
  );

  // Distance is a UI-only client hint until we wire lat/lng for the customer; we still expose
  // the chip so the surface matches Stitch HTML and persists a no-op preference.
  void distance;

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      const pickupLine = formatPickupLine(item.pickup_start, item.pickup_end);
      const retail = item.retail_value_estimate;
      const showStrike =
        typeof retail === 'number' && retail > item.rescue_price;
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
                {item.outlet_id ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.outlet_name ?? 'outlet'} profile`}
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
                      {item.outlet_name ?? 'Local partner'}
                    </StitchText>
                  </Pressable>
                ) : (
                  <StitchText
                    variant="body-sm"
                    colorKey="textMuted"
                    numberOfLines={1}
                    style={{ marginTop: 2 }}
                  >
                    {item.outlet_name ?? 'Local partner'}
                  </StitchText>
                )}
                {pickupLine ? (
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
    [navigation, styles],
  );

  return (
    <StitchScreen edges={['top', 'left', 'right']}>
      <View style={styles.pageHeader}>
        <StitchText variant="h1" colorKey="text">
          Search results
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Filter by category, distance, price, and pickup window.
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

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && hasMore && rows.length > 0) {
            void fetchPage(page + 1, false);
          }
        }}
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
