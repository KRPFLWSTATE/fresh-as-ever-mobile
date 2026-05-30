/**
 * OutletDetail (customer) — Stitch parity with the `outlet_detail_listing` spec.
 * Composition (mobile main):
 *   1. Hero image (cover) with back affordance + favourite toggle
 *   2. Outlet header (name, rating, distance)
 *   3. Active bags list — each row is Pressable into `BagDetail`
 *   4. Opening hours table (Mon–Sun)
 *   5. Address card with a **Get directions** button (opens maps URL)
 *   6. **Save to favourites** toggle wired through `useFavourites`
 *
 * Deep link: `freshasever://outlet/:outletId`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useFavourites } from '@/hooks/useFavourites';
import { openOutletDirections } from '@/lib/openOutletDirections';
import { getSupabase } from '@/lib/supabase';
import { useStitchTheme, type StitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow, stitchFonts } from '@/theme/stitchTokens';
import { OutletTrustBadge } from '@/components/OutletTrustBadge';
import { isGroupReservationsEnabled } from '@/config/groupReservations';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { canPublishClearanceShelves, canPublishRescueBags } from '@/lib/outletListingMode';
import { calcItemSavingsPercent, formatPickupByLabel } from '@/lib/shelfDisplay';
import {
  MAX_GROUP_BAGS,
  useReservationCart,
} from '@/hooks/useReservationCart';
import {
  StitchButton,
  StitchDivider,
  StitchIcon,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type Shelf = {
  id: string;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  liveItemCount: number;
  previewItemNames: string[];
  savingsPercentMin?: number;
  savingsPercentMax?: number;
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'OutletDetail'>;
type R = RouteProp<RootStackParamList, 'OutletDetail'>;

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_ORDER)[number];
const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

type Bag = {
  id: string;
  title: string;
  category: string | null;
  rescue_price: number;
  retail_value_estimate: number | null;
  image_url: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  quantity_remaining: number | null;
};

type Outlet = {
  id: string;
  name: string;
  address: string;
  landmark: string | null;
  category: string | null;
  cover_image_url: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  trust_score: number | null;
  collection_rate_pct: number | null;
  complaint_rate_pct: number | null;
  no_show_rate_pct: number | null;
  business_hours: Record<string, { open?: string; close?: string }> | null;
  merchant_name: string | null;
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

export function OutletDetailScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { env, user } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(
    () => createStyles({ colors, spacing, radii }),
    [colors, spacing, radii],
  );

  const outletId = String(route.params?.outletId ?? '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [bags, setBags] = useState<Bag[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);

  const customerId = user?.id ?? null;
  const { isSaved, toggleFavourite } = useFavourites(env, customerId);
  const saved = isSaved(outletId);
  const [favBusy, setFavBusy] = useState(false);
  const cart = useReservationCart();
  const groupReservationsEnabled = isGroupReservationsEnabled();
  const [selectedBagIds, setSelectedBagIds] = useState<string[]>([]);

  useEffect(() => {
    if (cart.cart.outletId === outletId) {
      setSelectedBagIds(cart.cart.bagIds);
    }
  }, [cart.cart.bagIds, cart.cart.outletId, outletId]);

  useEffect(() => {
    let alive = true;
    if (!outletId) {
      setError('Missing outlet id.');
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    (async () => {
      const sb = getSupabase(env);
      const [outletRes, bagsRes, shelvesRes] = await Promise.all([
        sb
          .from('outlets')
          .select(
            'id, name, address, landmark, category, cover_image_url, average_rating, total_reviews, trust_score, collection_rate_pct, complaint_rate_pct, no_show_rate_pct, business_hours, merchant:merchants(business_name)',
          )
          .eq('id', outletId)
          .maybeSingle(),
        sb
          .from('rescue_bags')
          .select(
            'id, title, category, rescue_price, retail_value_estimate, image_url, pickup_start, pickup_end, quantity_remaining, status',
          )
          .eq('outlet_id', outletId)
          .in('status', ['live', 'draft'])
          .gt('quantity_remaining', 0)
          .order('pickup_end', { ascending: true })
          .limit(20),
        isClearanceShelvesEnabled()
          ? sb
              .from('clearance_shelves')
              .select(
                'id, title, description, cover_image_url, pickup_start, pickup_end, status, items:clearance_shelf_items(id, status, quantity_remaining, name_snapshot, retail_price, rescue_price)',
              )
              .eq('outlet_id', outletId)
              .eq('status', 'published')
              .gt('pickup_end', new Date().toISOString())
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!alive) return;
      if (outletRes.error) {
        setError(outletRes.error.message);
        setOutlet(null);
        setBags([]);
        setShelves([]);
        setLoading(false);
        return;
      }
      const row = (outletRes.data ?? null) as Record<string, unknown> | null;
      if (!row) {
        setOutlet(null);
        setBags([]);
        setShelves([]);
        setLoading(false);
        return;
      }
      const merchant = row.merchant as Record<string, unknown> | undefined;
      setOutlet({
        id: String(row.id),
        name: String(row.name ?? 'Outlet'),
        address: String(row.address ?? ''),
        landmark: row.landmark != null ? String(row.landmark) : null,
        category: row.category != null ? String(row.category) : null,
        cover_image_url:
          row.cover_image_url != null ? String(row.cover_image_url) : null,
        average_rating:
          typeof row.average_rating === 'number'
            ? (row.average_rating as number)
            : row.average_rating != null
              ? Number(row.average_rating)
              : null,
        total_reviews:
          typeof row.total_reviews === 'number'
            ? row.total_reviews
            : row.total_reviews != null
              ? Number(row.total_reviews)
              : null,
        trust_score:
          typeof row.trust_score === 'number'
            ? row.trust_score
            : row.trust_score != null
              ? Number(row.trust_score)
              : null,
        collection_rate_pct:
          typeof row.collection_rate_pct === 'number'
            ? row.collection_rate_pct
            : row.collection_rate_pct != null
              ? Number(row.collection_rate_pct)
              : null,
        complaint_rate_pct:
          typeof row.complaint_rate_pct === 'number'
            ? row.complaint_rate_pct
            : row.complaint_rate_pct != null
              ? Number(row.complaint_rate_pct)
              : null,
        no_show_rate_pct:
          typeof row.no_show_rate_pct === 'number'
            ? row.no_show_rate_pct
            : row.no_show_rate_pct != null
              ? Number(row.no_show_rate_pct)
              : null,
        business_hours:
          row.business_hours && typeof row.business_hours === 'object'
            ? (row.business_hours as Outlet['business_hours'])
            : null,
        merchant_name:
          merchant?.business_name != null
            ? String(merchant.business_name)
            : null,
      });

      const outletCategory = row.category != null ? String(row.category) : '';
      const showBagsForOutlet =
        canPublishRescueBags(outletCategory);
      const showShelvesForOutlet =
        isClearanceShelvesEnabled() && canPublishClearanceShelves(outletCategory);

      const bagRows = showBagsForOutlet
        ? (((bagsRes.data ?? []) as Record<string, unknown>[]).map((b) => ({
            id: String(b.id),
            title: String(b.title ?? 'Rescue bag'),
            category: b.category != null ? String(b.category) : null,
            rescue_price: Number(b.rescue_price ?? 0),
            retail_value_estimate:
              b.retail_value_estimate != null
                ? Number(b.retail_value_estimate)
                : null,
            image_url: b.image_url != null ? String(b.image_url) : null,
            pickup_start:
              typeof b.pickup_start === 'string' ? b.pickup_start : null,
            pickup_end: typeof b.pickup_end === 'string' ? b.pickup_end : null,
            quantity_remaining:
              typeof b.quantity_remaining === 'number'
                ? b.quantity_remaining
                : null,
          })) as Bag[])
        : [];

      const shelfRows = showShelvesForOutlet
        ? ((shelvesRes.data ?? []) as Record<string, unknown>[])
            .map((shelf) => {
              const items = (shelf.items ?? []) as Record<string, unknown>[];
              const liveItems = items.filter(
                (i) =>
                  i.status === 'live' && Number(i.quantity_remaining ?? 0) > 0,
              );
              const liveCount = liveItems.length;
              if (liveCount === 0) return null;
              const previewItemNames = liveItems
                .slice(0, 3)
                .map((i) => String(i.name_snapshot ?? '').trim())
                .filter((n) => n.length > 0);
              const savingsPercents = liveItems
                .map((i) =>
                  calcItemSavingsPercent(
                    i.retail_price as string | number | null | undefined,
                    i.rescue_price as string | number | null | undefined,
                  ),
                )
                .filter((p) => p > 0);
              return {
                id: String(shelf.id),
                title:
                  typeof shelf.title === 'string' && shelf.title.trim().length > 0
                    ? shelf.title.trim()
                    : null,
                description:
                  typeof shelf.description === 'string' &&
                  shelf.description.trim().length > 0
                    ? shelf.description.trim()
                    : null,
                cover_image_url:
                  typeof shelf.cover_image_url === 'string' &&
                  shelf.cover_image_url.trim().length > 0
                    ? shelf.cover_image_url.trim()
                    : null,
                pickup_start:
                  typeof shelf.pickup_start === 'string' ? shelf.pickup_start : null,
                pickup_end:
                  typeof shelf.pickup_end === 'string' ? shelf.pickup_end : null,
                liveItemCount: liveCount,
                previewItemNames,
                ...(savingsPercents.length > 0
                  ? {
                      savingsPercentMin: Math.min(...savingsPercents),
                      savingsPercentMax: Math.max(...savingsPercents),
                    }
                  : {}),
              } as Shelf;
            })
            .filter((s): s is Shelf => s != null)
        : [];

      setBags(bagRows);
      setShelves(shelfRows);
      setLoading(false);
    })().catch((e) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'Failed to load outlet.');
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [env, outletId]);

  const onToggleFav = useCallback(async () => {
    if (!customerId) {
      navigation.navigate('Login');
      return;
    }
    setFavBusy(true);
    await toggleFavourite(outletId);
    setFavBusy(false);
  }, [customerId, navigation, outletId, toggleFavourite]);

  const onDirections = useCallback(() => {
    if (!outlet) return;
    openOutletDirections(outlet);
  }, [outlet]);

  const showShelves =
    isClearanceShelvesEnabled() && canPublishClearanceShelves(outlet?.category);
  const showBags =
    canPublishRescueBags(outlet?.category);

  if (loading) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  if (error || !outlet) {
    return (
      <View style={styles.fill}>
        <StitchText variant="h2" colorKey="text">
          Outlet not available
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={styles.errCopy}>
          {error ?? 'We couldn’t load this outlet right now.'}
        </StitchText>
        <StitchButton
          title="Go back"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const venue = outlet.merchant_name ?? outlet.name;

  return (
    <ScrollView style={styles.fillScroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.heroWrap}>
        {outlet.cover_image_url ? (
          <Image
            source={{ uri: outlet.cover_image_url }}
            style={styles.heroImg}
            resizeMode="cover"
            accessibilityLabel={`${outlet.name} cover image`}
          />
        ) : (
          <View style={[styles.heroImg, styles.heroFallback]}>
            <StitchIcon name="storefront" size={64} colorKey="outline" />
          </View>
        )}
        <View style={styles.heroOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconPill,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <StitchIcon name="arrow_back" size={22} colorKey="primaryContainer" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from favourites' : 'Save to favourites'}
            onPress={() => void onToggleFav()}
            disabled={favBusy}
            style={({ pressed }) => [
              styles.iconPill,
              { opacity: pressed ? 0.85 : favBusy ? 0.6 : 1 },
            ]}
          >
            <StitchIcon
              name={saved ? 'favorite' : 'favorite_border'}
              size={22}
              colorKey="primary"
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headerBlock}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <StitchText variant="h1" colorKey="text" numberOfLines={2}>
              {outlet.name}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              {venue}
            </StitchText>
          </View>
          <OutletTrustBadge
            trustScore={outlet.trust_score}
            averageRating={outlet.average_rating}
            totalReviews={outlet.total_reviews}
            collectionRatePct={outlet.collection_rate_pct}
            complaintRatePct={outlet.complaint_rate_pct}
            noShowRatePct={outlet.no_show_rate_pct}
          />
        </View>

        <View style={styles.metaRow}>
          {outlet.category ? (
            <View style={styles.categoryChip}>
              <StitchText variant="body-sm" colorKey="primaryActive" style={{ fontFamily: stitchFonts.semiBold }}>
                {outlet.category}
              </StitchText>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <StitchIcon name="location_on" size={16} colorKey="textMuted" />
            <StitchText variant="body-sm" colorKey="textMuted">
              Nearby
            </StitchText>
          </View>
        </View>

        {showShelves && shelves.length > 0 ? (
          <StitchSurface elevated padding="md" style={styles.cardBorder}>
            <View style={styles.sectionHeader}>
              <StitchText variant="h3" colorKey="text">
                Clearance shelves
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {shelves.length} live
              </StitchText>
            </View>
            <View style={{ gap: spacing.sm }}>
              {shelves.map((shelf) => {
                const pickupLine = formatPickupLine(shelf.pickup_start, shelf.pickup_end);
                const pickupBy = formatPickupByLabel(shelf.pickup_end);
                const savingsLine =
                  shelf.savingsPercentMin != null && shelf.savingsPercentMax != null
                    ? shelf.savingsPercentMin === shelf.savingsPercentMax
                      ? `Save up to ${shelf.savingsPercentMax}%`
                      : `Save ${shelf.savingsPercentMin}–${shelf.savingsPercentMax}%`
                    : null;
                const previewLine =
                  shelf.previewItemNames.length > 0
                    ? shelf.previewItemNames.join(' · ')
                    : null;
                return (
                  <Pressable
                    key={shelf.id}
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('ClearanceShelf', { id: shelf.id })
                    }
                    style={({ pressed }) => ({
                      padding: spacing.md,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      backgroundColor: pressed ? colors.surface2 : colors.surface,
                      opacity: pressed ? 0.95 : 1,
                      flexDirection: 'row',
                      gap: spacing.md,
                      alignItems: 'center',
                    })}
                  >
                    {shelf.cover_image_url ? (
                      <Image
                        source={{ uri: shelf.cover_image_url }}
                        style={{ width: 56, height: 56, borderRadius: radii.lg }}
                        accessibilityLabel={`${shelf.title ?? 'Clearance shelf'} cover`}
                      />
                    ) : (
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: radii.lg,
                          backgroundColor: colors.surfaceContainerHighest,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <StitchIcon name="local_mall" size={24} colorKey="textMuted" />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <StitchText variant="label" colorKey="text" numberOfLines={1}>
                        {shelf.title ?? "Today's clearance shelf"}
                      </StitchText>
                      {shelf.description ? (
                        <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
                          {shelf.description}
                        </StitchText>
                      ) : null}
                      <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                        {shelf.liveItemCount} item{shelf.liveItemCount === 1 ? '' : 's'}
                        {pickupLine ? ` · Pickup ${pickupLine}` : ''}
                        {pickupBy ? ` · ${pickupBy}` : ''}
                      </StitchText>
                      {previewLine ? (
                        <StitchText variant="body-sm" colorKey="text" numberOfLines={1} style={{ marginTop: 2 }}>
                          {previewLine}
                        </StitchText>
                      ) : null}
                      {savingsLine ? (
                        <StitchText variant="body-sm" colorKey="secondary" style={{ marginTop: 2 }}>
                          {savingsLine}
                        </StitchText>
                      ) : null}
                    </View>
                    <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
                  </Pressable>
                );
              })}
            </View>
          </StitchSurface>
        ) : null}

        {showBags ? (
        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <View style={styles.sectionHeader}>
            <StitchText variant="h3" colorKey="text">
              Active rescue bags
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              {bags.length} listed
            </StitchText>
          </View>
          {bags.length === 0 ? (
            <View style={styles.emptyBags}>
              <StitchIcon name="shopping_bag" size={36} colorKey="outline" />
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 6, textAlign: 'center' }}>
                No rescue bags right now. Save the outlet to get notified when new ones drop.
              </StitchText>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {bags.map((b, ix) => {
                const pickupLine = formatPickupLine(b.pickup_start, b.pickup_end);
                const retail = b.retail_value_estimate;
                const showStrike =
                  typeof retail === 'number' && retail > b.rescue_price;
                const selected = selectedBagIds.includes(b.id);
                const showGroupToggle = groupReservationsEnabled;
                return (
                  <View key={b.id} style={styles.bagRow}>
                    {showGroupToggle ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={selected ? 'Remove from group' : 'Add to group'}
                      onPress={() => {
                        void (async () => {
                          if (selected) {
                            await cart.removeBag(b.id);
                            setSelectedBagIds((ids) => ids.filter((id) => id !== b.id));
                            return;
                          }
                          const result = await cart.addBag({
                            id: b.id,
                            outletId,
                            title: b.title,
                            rescuePrice: b.rescue_price,
                          });
                          if (result.error === 'different_outlet') {
                            await cart.replaceOutletCart({
                              id: b.id,
                              outletId,
                              title: b.title,
                              rescuePrice: b.rescue_price,
                            });
                            setSelectedBagIds([b.id]);
                            return;
                          }
                          if (result.error === 'cart_full') return;
                          setSelectedBagIds((ids) =>
                            [...ids, b.id].slice(0, MAX_GROUP_BAGS),
                          );
                        })();
                      }}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.85 : 1,
                        marginRight: spacing.sm,
                      })}
                    >
                      <StitchIcon
                        name={selected ? 'check_circle' : 'add_circle'}
                        size={24}
                        colorKey={selected ? 'primary' : 'textMuted'}
                      />
                    </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => navigation.navigate('BagDetail', { id: b.id })}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.94 : 1,
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                      })}
                    >
                    <View style={[styles.bagRow, { flex: 1, borderWidth: 0 }]}>
                      {b.image_url ? (
                        <Image
                          source={{ uri: b.image_url }}
                          style={styles.bagThumb}
                          resizeMode="cover"
                          accessibilityLabel={`${b.title} preview`}
                        />
                      ) : (
                        <View style={[styles.bagThumb, styles.bagThumbFallback]}>
                          <StitchIcon name="shopping_bag" size={26} colorKey="textMuted" />
                        </View>
                      )}
                      <View style={{ flex: 1, paddingLeft: spacing.md, minWidth: 0 }}>
                        <StitchText variant="label" colorKey="text" numberOfLines={2}>
                          {b.title}
                        </StitchText>
                        {pickupLine ? (
                          <View style={styles.bagPickupRow}>
                            <StitchIcon name="schedule" size={14} colorKey="textMuted" />
                            <StitchText variant="body-sm" colorKey="textMuted">
                              {pickupLine}
                            </StitchText>
                          </View>
                        ) : null}
                        <View style={styles.bagPriceRow}>
                          {showStrike ? (
                            <StitchText variant="price-original" colorKey="textMuted">
                              {formatLkr(retail!)}
                            </StitchText>
                          ) : null}
                          <StitchText variant="price" colorKey="accent">
                            {formatLkr(b.rescue_price)}
                          </StitchText>
                        </View>
                      </View>
                      <StitchIcon name="chevron_right" size={22} colorKey="textFaint" />
                    </View>
                    </Pressable>
                    {ix < bags.length - 1 ? <StitchDivider /> : null}
                  </View>
                );
              })}
            </View>
          )}
        </StitchSurface>
        ) : null}

        {bags.length === 0 && (!showShelves || shelves.length === 0) ? (
          <StitchSurface elevated padding="md" style={styles.cardBorder}>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
              Nothing live at this outlet right now.
            </StitchText>
          </StitchSurface>
        ) : null}

        {groupReservationsEnabled && selectedBagIds.length > 0 ? (
          <StitchButton
            title={
              selectedBagIds.length === 1
                ? 'Reserve 1 bag'
                : `Reserve ${selectedBagIds.length} bags (card only)`
            }
            onPress={() =>
              navigation.navigate('Checkout', {
                draft: selectedBagIds[0],
                group: selectedBagIds.join(','),
              })
            }
          />
        ) : null}

        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <StitchText variant="h3" colorKey="text">
            Opening hours
          </StitchText>
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            {DAY_ORDER.map((day) => {
              const cell = outlet.business_hours?.[day];
              const open = cell?.open ?? '';
              const close = cell?.close ?? '';
              const display = open && close ? `${open} – ${close}` : 'Closed';
              return (
                <View key={day} style={styles.hoursRow}>
                  <StitchText variant="label" colorKey="text" style={{ width: 96 }}>
                    {DAY_LABEL[day]}
                  </StitchText>
                  <StitchText variant="body-md" colorKey="textMuted">
                    {display}
                  </StitchText>
                </View>
              );
            })}
          </View>
        </StitchSurface>

        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <StitchText variant="h3" colorKey="text">
            Address
          </StitchText>
          <StitchText variant="body-md" colorKey="text" style={{ marginTop: 6 }}>
            {outlet.address || 'Address pending'}
          </StitchText>
          {outlet.landmark ? (
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
              {outlet.landmark}
            </StitchText>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <StitchButton title="Get directions" onPress={onDirections} />
          </View>
        </StitchSurface>

        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <View style={styles.saveRow}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <StitchText variant="h3" colorKey="text">
                {saved ? 'Saved to favourites' : 'Save to favourites'}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Get notified when this outlet posts a new rescue bag.
              </StitchText>
            </View>
            <StitchButton
              title={saved ? 'Saved' : 'Save'}
              variant={saved ? 'secondary' : 'primary'}
              loading={favBusy}
              onPress={() => void onToggleFav()}
            />
          </View>
        </StitchSurface>
      </View>
    </ScrollView>
  );
}

function createStyles(props: {
  colors: StitchTheme['colors'];
  spacing: StitchTheme['spacing'];
  radii: StitchTheme['radii'];
}) {
  const { colors, spacing, radii } = props;
  const cardBorder: ViewStyle = {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  };
  return StyleSheet.create({
    fill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.pageMarginMobile,
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    errCopy: { textAlign: 'center' },
    fillScroll: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: spacing.xxl },
    heroWrap: {
      width: '100%',
      aspectRatio: 16 / 10,
      position: 'relative',
      backgroundColor: colors.surfaceContainerHighest,
    },
    heroImg: { width: '100%', height: '100%' },
    heroFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerHighest,
    },
    heroOverlay: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    iconPill: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.surface}E6`,
      alignItems: 'center',
      justifyContent: 'center',
      ...stitchAmbientShadow,
    },
    body: {
      padding: spacing.pageMarginMobile,
      gap: spacing.md,
    },
    headerBlock: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    ratingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceContainerLow,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      alignItems: 'center',
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    categoryChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.default,
      backgroundColor: colors.primaryHighlight,
    },
    cardBorder,
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    emptyBags: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    bagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    bagThumb: { width: 72, height: 72, borderRadius: radii.lg },
    bagThumbFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface2,
    },
    bagPickupRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    bagPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    hoursRow: { flexDirection: 'row', alignItems: 'center' },
    saveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
}
