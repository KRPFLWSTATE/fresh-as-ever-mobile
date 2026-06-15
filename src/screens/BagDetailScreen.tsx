import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { openOutletDirections } from '@/lib/openOutletDirections';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { customerBagDetailParams } from '@/contracts/routeParams';
import { useFavourites } from '@/hooks/useFavourites';
import { resolveBagAllergensFromBag } from '@/lib/bagAllergens';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchColorsDark } from '@/theme/stitchTokens';
import { OutletTrustBadge } from '@/components/OutletTrustBadge';
import { isGroupReservationsEnabled } from '@/config/groupReservations';
import { useReservationCart } from '@/hooks/useReservationCart';
import { StitchButton, StitchCard, StitchIcon, StitchText } from '@/ui/stitch';

function formatLKR(value: number): string {
  const n = Math.round(value);
  return `LKR ${n.toLocaleString('en-LK')}`;
}

function formatPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): { window: string; day: string } {
  if (!startIso || !endIso) return { window: '—', day: '' };
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { window: '—', day: '' };
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const window = `${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
  const today = new Date();
  const day =
    start.toDateString() === today.toDateString()
      ? 'Today'
      : start.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
  return { window, day };
}

export function BagDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'BagDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const parsed = customerBagDetailParams.safeParse(route.params);
  const id = parsed.success ? parsed.data.id : '';
  const { env, user } = useAuthContext();
  const customerId = user?.id ?? null;
  const { isSaved, toggleFavourite, loading: favLoading } = useFavourites(
    env,
    customerId,
  );
  const cart = useReservationCart();
  const groupReservationsEnabled = isGroupReservationsEnabled();
  const { colors, spacing, radii, mode } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = Dimensions.get('window');
  const heroHeight = Math.round(screenW * (397 / 390));

  const { styles, circleBtnBackground } = useMemo(
    () =>
      createStyles({
        colors,
        spacing,
        radii,
        mode,
        bottomInset: insets.bottom,
        heroHeight,
      }),
    [colors, spacing, radii, mode, insets.bottom, heroHeight],
  );

  const [bag, setBag] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchBag = useCallback(async () => {
    if (!id) return;
    const sb = getSupabase(env);
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await sb
        .from('rescue_bags')
        .select(
          `*, outlet:outlets ( id, name, address, landmark, location, is_halal_certified, average_rating, total_reviews, trust_score, collection_rate_pct, complaint_rate_pct, no_show_rate_pct, merchant:merchants(business_name) )`,
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      setBag(data as Record<string, unknown>);
    } catch {
      setErr('Bag unavailable.');
      setBag(null);
    } finally {
      setLoading(false);
    }
  }, [id, env]);

  useEffect(() => {
    if (!id) {
      navigation.goBack();
      return undefined;
    }
    void fetchBag();
  }, [id, env, navigation, fetchBag]);

  useEffect(() => {
    if (!id) return undefined;
    const sb = getSupabase(env);
    const channelName = `bag-${id}`;
    const channelTopic = `realtime:${channelName}`;

    // React remounts / noReset Appium runs reuse the same topic — drop stale channels
    // before calling `.on()` so Supabase never throws after an earlier `.subscribe()`.
    for (const existing of sb.getChannels()) {
      if (existing.topic === channelTopic) {
        void sb.removeChannel(existing);
      }
    }

    const channel = sb
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rescue_bags',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const n = payload.new as Record<string, unknown>;
          setBag((prev) =>
            prev
              ? {
                  ...prev,
                  quantity_remaining: n.quantity_remaining,
                  rescue_price: n.rescue_price,
                  retail_value_estimate: n.retail_value_estimate,
                }
              : null,
          );
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [id, env]);

  const outlet = bag?.outlet as Record<string, unknown> | undefined;
  const merch = outlet?.merchant as Record<string, unknown> | undefined;
  const outletId = outlet?.id != null ? String(outlet.id) : '';
  const outletSaved = outletId !== '' ? isSaved(outletId) : false;

  const onShare = useCallback(async () => {
    if (!bag) return;
    const title = typeof bag.title === 'string' ? bag.title : 'Rescue bag';
    try {
      await Share.share({
        message: `${title} — Fresh As Ever`,
      });
    } catch {
      /* ignore */
    }
  }, [bag]);

  if (!id || !parsed.success) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  if (err || !bag) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          {err ?? 'Missing.'}
        </StitchText>
        <StitchButton title="Retry" onPress={() => void fetchBag()} />
      </View>
    );
  }

  const title = typeof bag.title === 'string' ? bag.title : 'Bag';
  const notes = typeof bag.notes === 'string' ? bag.notes : '';
  const category =
    bag.category != null ? String(bag.category).replace(/_/g, ' ') : '';
  const rescuePrice =
    typeof bag.rescue_price === 'number' ? bag.rescue_price : 0;
  const retailRaw = bag.retail_value_estimate;
  const retail =
    typeof retailRaw === 'number' && Number.isFinite(retailRaw)
      ? retailRaw
      : null;
  const qty =
    typeof bag.quantity_remaining === 'number'
      ? bag.quantity_remaining
      : null;
  const pickupStart =
    typeof bag.pickup_start === 'string' ? bag.pickup_start : null;
  const pickupEnd =
    typeof bag.pickup_end === 'string' ? bag.pickup_end : null;
  const { window: pickupWindow, day: pickupDay } = formatPickupWindow(
    pickupStart,
    pickupEnd,
  );

  const venueCaps = [
    merch?.business_name != null ? String(merch.business_name) : '',
    outlet?.name != null ? String(outlet.name) : '',
  ]
    .filter(Boolean)
    .join(', ')
    .toUpperCase();

  const addressParts = [
    outlet?.address != null ? String(outlet.address) : '',
    outlet?.landmark != null ? String(outlet.landmark) : '',
  ].filter(Boolean);
  const addressLine = addressParts.join(' · ');

  const { allergens: resolvedAllergens, isHalal } = resolveBagAllergensFromBag(
    bag,
    title,
    notes,
    outlet ?? null,
  );
  const allergenPreview = resolvedAllergens.slice(0, 6);

  const showHighValue =
    retail != null && rescuePrice > 0 && retail / rescuePrice >= 1.5;
  const showUrgent = qty != null && qty > 0 && qty <= 3;

  const bottomReserved = spacing.md + 52 + Math.max(insets.bottom, spacing.md);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {mode === 'dark' ? (
        <View
          style={[
            styles.dockedNav,
            {
              backgroundColor: stitchColorsDark.headerBarDark,
              borderBottomColor: stitchColorsDark.divider,
              paddingTop: insets.top + spacing.xs,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.dockedNavBtn}
          >
            <StitchIcon
              name="arrow_back"
              size={22}
              color={stitchColorsDark.brandCyan}
            />
          </Pressable>
          <StitchText
            variant="h3"
            style={{ color: stitchColorsDark.brandCyan, letterSpacing: -0.5 }}
          >
            Fresh As Ever
          </StitchText>
          <View style={styles.dockedNavBtn} />
        </View>
      ) : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: bottomReserved,
          paddingTop: mode === 'dark' ? 56 + insets.top : 0,
        }}
      >
        <View style={[styles.heroWrap, { height: heroHeight }]}>
          {typeof bag.image_url === 'string' ? (
            <Image
              source={{ uri: bag.image_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              accessibilityLabel={`${bag.title} preview`}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.surfaceContainerHigh },
              ]}
            />
          )}
          <View style={styles.heroScrim} pointerEvents="none">
            <View style={{ flex: 1 }} />
            <View style={styles.heroScrimBottom} />
          </View>

          <View
            style={[
              styles.heroToolbar,
              { paddingTop: insets.top + spacing.sm },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.circleBtn,
                {
                  backgroundColor: circleBtnBackground,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <StitchIcon name="arrow_back" size={22} colorKey="onSurface" />
            </Pressable>

            <View style={styles.heroToolbarRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share"
                onPress={() => void onShare()}
                style={({ pressed }) => [
                  styles.circleBtn,
                  {
                    backgroundColor: circleBtnBackground,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <StitchIcon name="share" size={20} colorKey="onSurface" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  outletSaved ? 'Remove saved outlet' : 'Save outlet'
                }
                disabled={!outletId || favLoading}
                onPress={() => {
                  if (!user) {
                    navigation.navigate('Login');
                    return;
                  }
                  void toggleFavourite(outletId).then((r) => {
                    if (r.error === 'SIGN_IN_REQUIRED') {
                      navigation.navigate('Login');
                    }
                  });
                }}
                style={({ pressed }) => [
                  styles.circleBtn,
                  {
                    backgroundColor: circleBtnBackground,
                    opacity:
                      !outletId || favLoading ? 0.45 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                <StitchIcon
                  name={outletSaved ? 'favorite' : 'favorite_border'}
                  size={22}
                  colorKey="primaryContainer"
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.mainPad, { marginTop: -spacing.lg }]}>
          <StitchCard style={styles.headerCard}>
            {venueCaps ? (
              <StitchText
                variant="label-caps"
                colorKey="primaryContainer"
                style={{ marginBottom: spacing.xs }}
              >
                {venueCaps}
              </StitchText>
            ) : null}
            <StitchText variant="h1" colorKey="onSurface">
              {title}
            </StitchText>

            <View style={styles.chipRow}>
              {showHighValue ? (
                <View style={styles.chipSuccess}>
                  <StitchIcon name="eco" size={16} colorKey="success" />
                  <StitchText variant="label" colorKey="success">
                    High Value Rescue
                  </StitchText>
                </View>
              ) : null}
              {showUrgent ? (
                <View style={styles.chipUrgent}>
                  <StitchIcon name="error" size={16} colorKey="accent" />
                  <StitchText variant="label" colorKey="accent">
                    Hurry, only {qty} left!
                  </StitchText>
                </View>
              ) : null}
              {!showHighValue && !showUrgent ? (
                <StitchText variant="body-sm" colorKey="textMuted">
                  Rescue pricing · surplus food
                </StitchText>
              ) : null}
            </View>
          </StitchCard>

          <View style={{ paddingHorizontal: spacing.xs, marginBottom: spacing.lg }}>
            {notes ? (
              <StitchText
                variant="body-md"
                colorKey="onSurfaceVariant"
                style={{ marginBottom: spacing.md }}
              >
                {notes}
              </StitchText>
            ) : (
              <StitchText
                variant="body-md"
                colorKey="onSurfaceVariant"
                style={{ marginBottom: spacing.md }}
              >
                Surprise surplus items from today’s batch — contents vary.
              </StitchText>
            )}

            <View style={styles.allergenChipWrap}>
              {isHalal === true ? (
                <View style={styles.allergenChip}>
                  <StitchText variant="body-sm" colorKey="onSurfaceVariant">
                    Halal certified
                  </StitchText>
                </View>
              ) : null}
              {allergenPreview.map((a) => (
                <View key={a} style={styles.allergenChip}>
                  <StitchText variant="body-sm" colorKey="onSurfaceVariant">
                    {a}
                  </StitchText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => navigation.navigate('BagAllergens', { bagId: id })}
              style={({ pressed }) => [
                styles.allergenLink,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                Allergen & dietary information
              </StitchText>
              <StitchIcon name="chevron_right" size={20} colorKey="primaryContainer" />
            </Pressable>
          </View>

          <View style={styles.bento}>
            <View
              style={[
                styles.bentoCard,
                styles.bentoCardRow,
                { borderColor: colors.outlineVariant },
              ]}
            >
              <View style={[styles.iconBubble, { backgroundColor: colors.primaryHighlight }]}>
                <StitchIcon name="schedule" size={22} colorKey="primaryContainer" />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="onSurfaceVariant" style={{ marginBottom: spacing.xs }}>
                  Pickup Window
                </StitchText>
                <StitchText variant="h3" colorKey="onSurface">
                  {pickupWindow}
                </StitchText>
                {pickupDay ? (
                  <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                    {pickupDay}
                  </StitchText>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.bentoCard,
                styles.bentoCardCol,
                { borderColor: colors.outlineVariant },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={[styles.iconBubble, { backgroundColor: colors.primaryHighlight }]}>
                  <StitchIcon name="location_on" size={22} colorKey="primaryContainer" />
                </View>
                <View style={{ flex: 1 }}>
                  <StitchText variant="label" colorKey="onSurfaceVariant" style={{ marginBottom: spacing.xs }}>
                    Pickup Location
                  </StitchText>
                  <StitchText variant="body-md" colorKey="onSurface">
                    {outlet?.name ? String(outlet.name) : 'Outlet'}
                  </StitchText>
                  <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                    <OutletTrustBadge
                      size="sm"
                      trustScore={
                        typeof outlet?.trust_score === 'number'
                          ? outlet.trust_score
                          : outlet?.trust_score != null
                            ? Number(outlet.trust_score)
                            : null
                      }
                      averageRating={
                        typeof outlet?.average_rating === 'number'
                          ? outlet.average_rating
                          : outlet?.average_rating != null
                            ? Number(outlet.average_rating)
                            : null
                      }
                      totalReviews={
                        typeof outlet?.total_reviews === 'number'
                          ? outlet.total_reviews
                          : outlet?.total_reviews != null
                            ? Number(outlet.total_reviews)
                            : null
                      }
                      collectionRatePct={
                        typeof outlet?.collection_rate_pct === 'number'
                          ? outlet.collection_rate_pct
                          : outlet?.collection_rate_pct != null
                            ? Number(outlet.collection_rate_pct)
                            : null
                      }
                      complaintRatePct={
                        typeof outlet?.complaint_rate_pct === 'number'
                          ? outlet.complaint_rate_pct
                          : outlet?.complaint_rate_pct != null
                            ? Number(outlet.complaint_rate_pct)
                            : null
                      }
                      noShowRatePct={
                        typeof outlet?.no_show_rate_pct === 'number'
                          ? outlet.no_show_rate_pct
                          : outlet?.no_show_rate_pct != null
                            ? Number(outlet.no_show_rate_pct)
                            : null
                      }
                    />
                  </View>
                  {addressLine ? (
                    <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                      {addressLine}
                    </StitchText>
                  ) : null}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  openOutletDirections({
                    name: outlet?.name != null ? String(outlet.name) : null,
                    address: outlet?.address != null ? String(outlet.address) : null,
                    landmark: outlet?.landmark != null ? String(outlet.landmark) : null,
                  })
                }
                style={({ pressed }) => ({
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <View
                  style={[
                    styles.mapThumb,
                    {
                      borderColor: colors.outlineVariant,
                      backgroundColor: colors.surface2,
                    },
                  ]}
                >
                  {(() => {
                    const parsedCoords = parseOutletCoords(outlet?.location);
                    const c = parsedCoords ?? FALLBACK_COORDS;
                    return (
                      <Image
                        source={{
                          uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${c.lat},${c.lng}&zoom=14&size=192x192&maptype=mapnik`,
                        }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessible={false}
                      />
                    );
                  })()}
                  <View style={styles.mapPinOverlay}>
                    <StitchIcon name="location_on" size={28} colorKey="primaryContainer" />
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: spacing.sm,
                  }}
                >
                  <StitchIcon name="location_on" size={18} colorKey="primaryContainer" />
                  <StitchText variant="label" colorKey="primaryContainer">
                    Get Directions
                  </StitchText>
                </View>
              </Pressable>
            </View>
          </View>

          {category ? (
            <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.xs }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Category
              </StitchText>
              <StitchText variant="body-md" colorKey="onSurface" style={{ marginTop: spacing.xs }}>
                {category}
              </StitchText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor:
              mode === 'dark' ? stitchColorsDark.headerBarDark : colors.surface,
            borderTopColor: colors.outlineVariant,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={styles.bottomInner}>
          <View style={{ flex: 1 }}>
            {retail != null && retail > rescuePrice ? (
              <StitchText variant="price-original" colorKey="textMuted">
                {formatLKR(retail)}
              </StitchText>
            ) : null}
            <StitchText variant="price" colorKey="accent">
              {formatLKR(rescuePrice)}
            </StitchText>
            {groupReservationsEnabled && outletId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void cart.addBag({
                    id,
                    outletId,
                    title: String(bag?.title ?? 'Bag'),
                    rescuePrice,
                  }).then((result) => {
                    if (result.error === 'different_outlet') {
                      void cart.replaceOutletCart({
                        id,
                        outletId,
                        title: String(bag?.title ?? 'Bag'),
                        rescuePrice,
                      });
                    }
                    navigation.navigate('OutletDetail', { outletId });
                  });
                }}
                style={{ marginTop: spacing.xs }}
              >
                <StitchText variant="body-sm" colorKey="primary">
                  Add to group order
                </StitchText>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Checkout', { draft: id })}
            style={({ pressed }) => [
              styles.reserveCta,
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                backgroundColor:
                  mode === 'dark' ? colors.darkPrimary : colors.primaryContainer,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <StitchIcon
              name="shopping_bag"
              size={18}
              colorKey={mode === 'dark' ? 'onPrimary' : 'onPrimaryContainer'}
            />
            <StitchText
              variant="label"
              colorKey={mode === 'dark' ? 'onPrimary' : 'onPrimaryContainer'}
            >
              Reserve Now
            </StitchText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type StyleParams = {
  colors: ReturnType<typeof useStitchTheme>['colors'];
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
  mode: ReturnType<typeof useStitchTheme>['mode'];
  bottomInset: number;
  heroHeight: number;
};

function createStyles(p: StyleParams): {
  styles: ReturnType<typeof StyleSheet.create>;
  circleBtnBackground: string;
} {
  const { colors, spacing, radii, mode } = p;
  const circleBtnBackground =
    mode === 'dark' ? 'rgba(37,36,32,0.92)' : 'rgba(255,255,255,0.92)';

  const styles = StyleSheet.create({
    root: { flex: 1 },
    dockedNav: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dockedNavBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.lg,
    },
    heroWrap: {
      width: '100%',
      backgroundColor: colors.surfaceContainerHigh,
    },
    heroScrim: {
      ...StyleSheet.absoluteFill,
      flexDirection: 'column',
    },
    heroScrimBottom: {
      height: '34%',
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    heroToolbar: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      top: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroToolbarRight: { flexDirection: 'row', gap: spacing.sm },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: { elevation: 4 },
      }),
    },
    mainPad: {
      paddingHorizontal: spacing.pageMarginMobile,
      zIndex: 2,
    },
    headerCard: {
      marginBottom: spacing.lg,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
      alignItems: 'center',
    },
    chipSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.default,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.success}33`,
      backgroundColor: colors.surfaceBright,
    },
    chipUrgent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    allergenChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    allergenChip: {
      paddingHorizontal: 12,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainer,
    },
    allergenLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.md,
    },
    bento: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    bentoCard: {
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.03,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    bentoCardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    bentoCardCol: {
      flexDirection: 'column',
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapThumb: {
      position: 'relative',
      width: '100%',
      height: 96,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    mapPinOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
        },
        android: { elevation: 12 },
      }),
    },
    bottomInner: {
      maxWidth: 768,
      width: '100%',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    reserveCta: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.lg,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.primaryContainer,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
  });

  return { styles, circleBtnBackground };
}
