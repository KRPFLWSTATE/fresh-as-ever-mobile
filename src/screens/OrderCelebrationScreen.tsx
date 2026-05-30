import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { RouteProp } from '@react-navigation/native';
import {
  CommonActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import { getCelebrationCopy } from '@/content/celebrationMoments';
import { formatPickupLine } from '@/domain/pickupWindow';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import { ERROR } from '@/lib/messages/errors';
import { orderDisplayTitle, orderPickupWindow } from '@/lib/orderDisplay';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { CelebrationHero } from '@/ui/celebration/CelebrationHero';
import {
  StitchButton,
  StitchCard,
  StitchIcon,
  StitchText,
} from '@/ui/stitch';

type BagJoin = {
  title?: string | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
  retail_value_estimate?: number | null;
  rescue_price?: number | null;
} | null;

type OutletJoin = {
  name?: string | null;
  merchant?: { business_name?: string | null } | null;
} | null;

type GroupJoin = {
  reservation_code?: string | null;
  bag_count?: number | null;
} | null;

type OrderCelebrationRow = {
  id: string;
  reservation_code: string | null;
  group_id: string | null;
  group?: GroupJoin | GroupJoin[];
  total: number | null;
  shelf_id?: string | null;
  order_items?: { name_snapshot?: string | null; quantity?: number | null }[] | null;
  bag: BagJoin;
  shelf?: { pickup_start?: string | null; pickup_end?: string | null } | null;
  outlet: OutletJoin;
};

function resolveGroupJoin(row: OrderCelebrationRow): GroupJoin {
  const g = row.group;
  if (Array.isArray(g)) return g[0] ?? null;
  return g ?? null;
}

function resolveReservationCode(row: OrderCelebrationRow): string | null {
  const direct = row.reservation_code?.trim();
  if (direct) return direct;
  return resolveGroupJoin(row)?.reservation_code?.trim() ?? null;
}

function formatLKR(value: number): string {
  const n = Math.round(value);
  return `LKR ${n.toLocaleString('en-LK')}`;
}

function formatOrderRef(id: string, reservationCode: string | null): string {
  const rc = reservationCode?.trim();
  if (rc) return `#FAE-${rc}`;
  const tail = id.replace(/-/g, '').slice(-8).toUpperCase();
  return `#FAE-${tail.slice(0, 5)}`;
}

function formatVerificationDisplay(code: string | null): string {
  const c = String(code ?? '')
    .replace(/\s/g, '')
    .slice(0, 6)
    .toUpperCase();
  return c || '——';
}

function useStaggerEntrance(enabled: boolean, count: number) {
  const values = useRef(
    Array.from({ length: count }, () => new Animated.Value(enabled ? 0 : 1)),
  ).current;

  useEffect(() => {
    if (!enabled) {
      values.forEach((v) => v.setValue(1));
      return;
    }
    const anims = values.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 420,
        delay: 80 + i * 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    Animated.stagger(60, anims).start();
  }, [enabled, values]);

  return values.map((opacity) => ({
    opacity,
    transform: [
      {
        translateY: opacity.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  }));
}

function useCountUp(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(enabled ? 0 : target);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled || target <= 0) {
      setDisplay(target);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => {
      setDisplay(Math.round(value * target));
    });
    Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      delay: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(id);
    };
  }, [anim, enabled, target]);

  return display;
}

export function OrderCelebrationScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'OrderCelebration'>>();
  const { orderId, variant } = route.params;
  const { env } = useAuthContext();
  const { colors, spacing, radii, mode } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const [row, setRow] = useState<OrderCelebrationRow | null>(null);
  const [groupBags, setGroupBags] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const copy = useMemo(() => getCelebrationCopy(variant), [variant]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || loading || !row) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [loading, reduceMotion, row]);

  const motionOn = !reduceMotion && !loading && !!row;
  const stagger = useStaggerEntrance(motionOn, 5);

  const primaryHighlightSoft = useMemo(
    () =>
      mode === 'dark'
        ? 'rgba(1, 105, 111, 0.22)'
        : 'rgba(208, 232, 230, 0.35)',
    [mode],
  );

  const load = useCallback(async () => {
    const sb = getSupabase(env);
    setLoading(true);
    const { data, error } = await sb
      .from('orders')
      .select(
        `
          id,
          reservation_code,
          group_id,
          group:reservation_groups(reservation_code, bag_count),
          total,
          shelf_id,
          order_items(name_snapshot, quantity),
          shelf:clearance_shelves(pickup_start, pickup_end),
          bag:rescue_bags(title, pickup_start, pickup_end, retail_value_estimate, rescue_price),
          outlet:outlets(name, merchant:merchants(business_name))
        `,
      )
      .eq('id', orderId)
      .maybeSingle();
    setLoading(false);
    const nextRow = error ? null : (data as OrderCelebrationRow);
    setRow(nextRow);
    if (nextRow?.group_id) {
      const { data: siblings } = await sb
        .from('orders')
        .select('id, bag:rescue_bags(title)')
        .eq('group_id', nextRow.group_id)
        .order('created_at', { ascending: true });
      const list = (siblings ?? []).map((entry) => ({
        id: String((entry as { id: string }).id),
        title: String(
          ((entry as { bag?: { title?: string } }).bag?.title ?? 'Bag'),
        ),
      }));
      setGroupBags(list);
    } else {
      setGroupBags([]);
    }
  }, [env, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const outlet = row?.outlet;
  const bag = row?.bag;
  const groupJoin = row ? resolveGroupJoin(row) : null;
  const displayReservationCode = row ? resolveReservationCode(row) : null;
  const groupBagCount =
    groupBags.length > 0
      ? groupBags.length
      : typeof groupJoin?.bag_count === 'number'
        ? groupJoin.bag_count
        : null;
  const venue =
    typeof outlet?.merchant?.business_name === 'string' &&
    outlet.merchant.business_name
      ? outlet.merchant.business_name
      : typeof outlet?.name === 'string'
        ? outlet.name
        : 'Outlet';
  const title = row
    ? orderDisplayTitle({
        shelf_id: row.shelf_id,
        bag,
        order_items: row.order_items,
      })
    : 'Rescue order';
  const pickup = row
    ? orderPickupWindow({
        shelf_id: row.shelf_id,
        bag,
        shelf: row.shelf,
      })
    : { start: null, end: null };
  const pickupLine = formatPickupLine(pickup.start, pickup.end);
  const retail =
    typeof bag?.retail_value_estimate === 'number'
      ? bag.retail_value_estimate
      : null;
  const rescue =
    typeof bag?.rescue_price === 'number' ? bag.rescue_price : null;
  const savedEstimate =
    retail != null && rescue != null
      ? Math.max(0, Math.round(retail - rescue))
      : typeof row?.total === 'number'
        ? Math.round(row.total)
        : 0;
  const savedDisplay = useCountUp(savedEstimate, motionOn && variant === 'rescue');

  const goOrderDetail = () =>
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'OrderDetail', params: { orderId } }],
      }),
    );

  const goDiscover = () =>
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'DiscoverTab' } }],
      }),
    );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flexGrow: 1,
          paddingHorizontal: spacing.pageMarginMobile,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xxl + Math.max(insets.bottom, spacing.md),
          justifyContent: 'center',
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        },
        gridHalf: {
          flexGrow: 1,
          flexBasis: '45%',
          minWidth: 140,
        },
        gridFull: {
          width: '100%',
        },
        outletRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.md,
        },
        iconBubble: {
          width: 48,
          height: 48,
          borderRadius: radii.lg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pickupChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radii.default,
          marginTop: spacing.xs,
        },
        actions: {
          gap: spacing.sm,
          width: '100%',
        },
        primaryBtnRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
      }),
    [spacing, radii, insets.bottom],
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  if (!row) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <StitchText variant="body-md" colorKey="onSurface">
          {ERROR.common.fallback}
        </StitchText>
        <StitchButton title="Try again" onPress={() => void load()} />
      </View>
    );
  }

  if (variant === 'rescue') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ alignItems: 'center', marginBottom: spacing.lg }, stagger[0]]}>
            <CelebrationHero
              variant="rescue"
              filledCheck={copy.filledCheck}
              reduceMotion={reduceMotion}
            />
          </Animated.View>

          <Animated.View style={[{ alignItems: 'center', marginBottom: spacing.xl }, stagger[1]]}>
            <StitchText variant="h1" colorKey="text" style={{ textAlign: 'center' }}>
              {copy.headline}
            </StitchText>
            <StitchText
              variant="body-md"
              colorKey="textMuted"
              style={{ textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md }}
            >
              {copy.subcopy}
            </StitchText>
          </Animated.View>

          <Animated.View style={stagger[2]}>
            <View style={styles.grid}>
              <StitchCard style={styles.gridHalf} padding="md">
                <StitchText variant="label-caps" colorKey="textMuted">
                  {copy.codeLabel}
                </StitchText>
                <StitchText variant="h2" colorKey="text" style={{ marginTop: spacing.xs }}>
                  {formatOrderRef(row.id, displayReservationCode)}
                </StitchText>
              </StitchCard>

              <StitchCard style={styles.gridHalf} padding="md">
                <StitchText variant="label-caps" colorKey="textMuted">
                  Total Saved
                </StitchText>
                <View style={[styles.primaryBtnRow, { marginTop: spacing.xs, justifyContent: 'flex-start' }]}>
                  <StitchIcon name="arrow_downward" size={20} colorKey="success" />
                  <StitchText variant="h2" colorKey="success">
                    {formatLKR(savedDisplay)}
                  </StitchText>
                </View>
              </StitchCard>

              <StitchCard style={styles.gridFull} padding="md">
                <View style={styles.outletRow}>
                  <View
                    style={[
                      styles.iconBubble,
                      { backgroundColor: colors.surfaceContainer },
                    ]}
                  >
                    <StitchIcon name="storefront" size={28} colorKey="primaryContainer" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <StitchText variant="h3" colorKey="text">
                      {venue}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
                      {title}
                    </StitchText>
                    {groupBagCount != null && groupBagCount > 1 ? (
                      <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
                        {groupBagCount} bags in this group order
                      </StitchText>
                    ) : null}
                    <View
                      style={[
                        styles.pickupChip,
                        { backgroundColor: primaryHighlightSoft },
                      ]}
                    >
                      <StitchIcon name="schedule" size={16} colorKey="primaryContainer" />
                      <StitchText variant="label" colorKey="primaryContainer">
                        {pickupLine}
                      </StitchText>
                    </View>
                  </View>
                </View>
                {groupBags.length > 1 ? (
                  <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                    {groupBags.map((entry) => (
                      <StitchText key={entry.id} variant="body-sm" colorKey="text">
                        · {entry.title}
                      </StitchText>
                    ))}
                  </View>
                ) : null}
              </StitchCard>
            </View>
          </Animated.View>

          <Animated.View style={[styles.actions, stagger[3]]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.primaryCta}
              onPress={goOrderDetail}
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: radii.lg,
                backgroundColor: colors.primaryContainer,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <StitchIcon name="qr_code_scanner" size={20} colorKey="onPrimary" />
              <StitchText variant="label" colorKey="onPrimary">
                {copy.primaryCta}
              </StitchText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs' }],
                  }),
                )
              }
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.surfaceContainer : 'transparent',
              })}
            >
              <StitchText variant="label" colorKey="text">
                {copy.secondaryCta}
              </StitchText>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  const codeDisplay = formatVerificationDisplay(displayReservationCode);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[{ alignItems: 'center', marginBottom: spacing.xl }, stagger[0]]}>
          <CelebrationHero
            variant="reservation"
            filledCheck={copy.filledCheck}
            reduceMotion={reduceMotion}
          />
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', marginBottom: spacing.xl, width: '100%' }, stagger[1]]}>
          <StitchText variant="h1" colorKey="onBackground" style={{ textAlign: 'center' }}>
            {copy.headline}
          </StitchText>
          <StitchText
            variant="body-md"
            colorKey="textMuted"
            style={{ textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md }}
          >
            {copy.subcopy}
          </StitchText>
        </Animated.View>

        <Animated.View style={stagger[2]}>
          <StitchCard
            style={{
              marginBottom: spacing.xl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: `${colors.divider}66`,
            }}
            padding="lg"
          >
            <StitchText
              variant="label-caps"
              colorKey="textMuted"
              style={{ textAlign: 'center', marginBottom: spacing.xs }}
            >
              {copy.codeLabel}
            </StitchText>
            <StitchText
              variant="display"
              colorKey="primaryContainer"
              style={{ textAlign: 'center', letterSpacing: 8 }}
            >
              {codeDisplay}
            </StitchText>
            {groupBagCount != null && groupBagCount > 1 ? (
              <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center', marginTop: spacing.sm }}>
                {groupBagCount} bags · one code for pickup
              </StitchText>
            ) : null}
            {groupBags.length > 1 ? (
              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                {groupBags.map((entry) => (
                  <StitchText key={entry.id} variant="body-sm" colorKey="text" style={{ textAlign: 'center' }}>
                    {entry.title}
                  </StitchText>
                ))}
              </View>
            ) : null}
          </StitchCard>
        </Animated.View>

        <Animated.View style={[styles.actions, stagger[3]]}>
          <StitchButton
            title={copy.primaryCta}
            onPress={goOrderDetail}
            style={{ width: '100%' }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={goDiscover}
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: radii.lg,
              borderWidth: 1.5,
              borderColor: colors.primaryContainer,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? primaryHighlightSoft : 'transparent',
            })}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              {copy.secondaryCta}
            </StitchText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
