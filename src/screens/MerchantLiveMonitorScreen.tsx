import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantDashboard } from '@/hooks/useMerchantDashboard';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { isApproachingWithin2h } from '@/domain/pickupWindow';
import {
  customerPickupSignal,
  customerPickupSignalHeroLabel,
  customerPickupSignalHeroSubcopy,
} from '@/domain/customerPickupSignals';
import { isOnMyWayEnabled } from '@/config/featureFlags';
import { isOrderCollectible } from '@/domain/merchantOrderFilters';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type ApproachingPickupRow = {
  id: string;
  bag: string;
  order: string;
  customer: string;
  eta: string;
  urgent: boolean;
  /** Minutes until pickup_end; used to refresh the urgent threshold without re-querying. */
  minutesUntilPickup: number;
};

export function MerchantLiveMonitorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { stats, loading, error, refetch } = useMerchantDashboard(env);
  const { authorizeHandoverByCode } = useMerchantOrders(env, 'live-monitor');
  const { activeOutlet, outletScopeIds, loading: ctxLoading } = useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [queueRows, setQueueRows] = useState<ApproachingPickupRow[] | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [arrivalHero, setArrivalHero] = useState<ApproachingPickupRow | null>(null);
  const [arrivalHeroSignal, setArrivalHeroSignal] = useState<
    ReturnType<typeof customerPickupSignal>
  >(null);
  const onMyWayEnabled = isOnMyWayEnabled();

  // Live ETA ticker: re-render every 30s so minutesUntilPickup drifts down without
  // refetching. We only display `Math.max(0, original - elapsedMin)`.
  const [tickMs, setTickMs] = useState(Date.now());
  const [queueLoadedAt, setQueueLoadedAt] = useState<number>(Date.now());
  useEffect(() => {
    const handle = setInterval(() => setTickMs(Date.now()), 30_000);
    return () => clearInterval(handle);
  }, []);

  const outletLabel = activeOutlet?.name?.trim() || 'Your outlet';

  const loadQueue = useCallback(async () => {
    if (outletScopeIds.length === 0) {
      setQueueRows([]);
      setQueueLoading(false);
      return;
    }
    setQueueLoading(true);
    setQueueError(null);
    const sb = getSupabase(env);
    const nowMs = Date.now();
    const now = new Date(nowMs);
    const horizon = new Date(nowMs + 2 * 60 * 60 * 1000);
    const { data, error: qErr } = await sb
      .from('orders')
      .select(
        `
        id,
        reservation_code,
        order_status,
        payment_status,
        customer_arrived_at,
        customer_on_the_way_at,
        customer:profiles(full_name),
        bag:rescue_bags!inner(title, pickup_start, pickup_end)
      `,
      )
      .in('outlet_id', outletScopeIds)
      .in('order_status', ['reserved', 'awaiting_pickup', 'paid'])
      .gt('bag.pickup_end', now.toISOString())
      .lt('bag.pickup_end', horizon.toISOString())
      .order('pickup_end', { foreignTable: 'bag', ascending: true })
      .limit(20);

    if (qErr) {
      setQueueError(qErr.message);
      setQueueRows([]);
      setArrivalHero(null);
      setArrivalHeroSignal(null);
      setQueueLoading(false);
      return;
    }

    const eligible = ((data ?? []) as Record<string, unknown>[]).filter((o) => {
      const st = normalizeOrderStatus(String(o.order_status ?? ''));
      const paymentStatus =
        typeof o.payment_status === 'string' ? o.payment_status : null;
      const pickupEnd =
        typeof (o.bag as Record<string, unknown> | undefined)?.pickup_end === 'string'
          ? String((o.bag as Record<string, unknown>).pickup_end)
          : null;
      if (!isApproachingWithin2h(nowMs, pickupEnd)) return false;
      return isOrderCollectible({
        status: st,
        order_status_raw: String(o.order_status ?? ''),
        payment_status: paymentStatus,
      });
    });

    const arrived = eligible
      .filter((o) => typeof o.customer_arrived_at === 'string' && o.customer_arrived_at)
      .sort(
        (a, b) =>
          new Date(String(b.customer_arrived_at)).getTime() -
          new Date(String(a.customer_arrived_at)).getTime(),
      );

    const enRoute = onMyWayEnabled
      ? eligible
          .filter(
            (o) =>
              !(typeof o.customer_arrived_at === 'string' && o.customer_arrived_at) &&
              typeof o.customer_on_the_way_at === 'string' &&
              o.customer_on_the_way_at,
          )
          .sort(
            (a, b) =>
              new Date(String(b.customer_on_the_way_at)).getTime() -
              new Date(String(a.customer_on_the_way_at)).getTime(),
          )
      : [];

    const rows: ApproachingPickupRow[] = eligible.map((o) => {
      const bag = o.bag as Record<string, unknown> | undefined;
      const customer = o.customer as Record<string, unknown> | undefined;
      const pickupEndRaw = typeof bag?.pickup_end === 'string' ? (bag.pickup_end as string) : null;
      const pickupEnd = pickupEndRaw ? new Date(pickupEndRaw) : null;
      const minutes = pickupEnd
        ? Math.max(0, Math.round((pickupEnd.getTime() - Date.now()) / 60000))
        : 0;
      const eta = pickupEnd ? `${minutes} min` : '—';
      // Anything inside 20m is "urgent" — keeps the visual hierarchy useful even after we
      // expand the horizon to 2 hours.
      const urgent = minutes <= 20;
      const trimmedCode = String(o.reservation_code ?? '').trim();
      return {
        id: String(o.id ?? ''),
        bag: String(bag?.title ?? '') || 'Rescue bag',
        order: trimmedCode
          ? `Order #${trimmedCode}`
          : `Order ${String(o.id ?? '').slice(0, 6)}`,
        customer: String(customer?.full_name ?? '') || 'Customer',
        eta,
        urgent,
        minutesUntilPickup: minutes,
      };
    });

    const arrivedIds = new Set(arrived.map((o) => String(o.id ?? '')));
    const enRouteIds = new Set(enRoute.map((o) => String(o.id ?? '')));
    const signalSource = arrived[0] ?? enRoute[0] ?? null;
    const heroRow =
      rows.find((r) => arrivedIds.has(r.id)) ??
      rows.find((r) => enRouteIds.has(r.id)) ??
      rows[0] ??
      null;
    setArrivalHero(heroRow);
    setArrivalHeroSignal(
      signalSource
        ? customerPickupSignal({
            customer_arrived_at:
              typeof signalSource.customer_arrived_at === 'string'
                ? signalSource.customer_arrived_at
                : null,
            customer_on_the_way_at:
              typeof signalSource.customer_on_the_way_at === 'string'
                ? signalSource.customer_on_the_way_at
                : null,
          })
        : null,
    );
    setQueueRows(rows);
    setQueueLoadedAt(Date.now());
    setQueueLoading(false);
  }, [env, onMyWayEnabled, outletScopeIds]);

  useEffect(() => {
    if (ctxLoading) return;
    void loadQueue();
  }, [ctxLoading, loadQueue]);

  // Recompute displayed ETAs from wall-clock without re-querying Supabase.
  const renderedQueue: ApproachingPickupRow[] = useMemo(() => {
    const elapsedMin = Math.max(
      0,
      Math.floor((tickMs - queueLoadedAt) / 60_000),
    );
    function tick(row: ApproachingPickupRow): ApproachingPickupRow {
      const remaining = Math.max(0, row.minutesUntilPickup - elapsedMin);
      return {
        ...row,
        minutesUntilPickup: remaining,
        urgent: remaining <= 20,
        eta: remaining === 0 ? 'Now' : `${remaining} min`,
      };
    }
    return (queueRows ?? []).map(tick);
  }, [queueRows, queueLoadedAt, tickMs]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: radii.lg,
      overflow: 'hidden',
    };
    const statTile: ViewStyle = {
      flex: 1,
      minWidth: 0,
      borderRadius: radii.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const queueCard: ViewStyle = {
      borderRadius: radii.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    };
    const twoCol: ViewStyle = {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    };
    const leftCol: ViewStyle = { flex: 1, minWidth: 280, gap: spacing.lg };
    const rightCol: ViewStyle = { flex: 1, minWidth: 260, gap: spacing.md };
    const headerRow: ViewStyle = {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: spacing.sm,
    };
    const pill: ViewStyle = {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    };
    const alertHeader: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: `${colors.secondary}14`,
    };
    const statRow: ViewStyle = { flexDirection: 'row', gap: spacing.md };
    const codeRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'stretch',
    };
    const inlineRowSm: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    };
    const inlineRowBaseline: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    };
    const queueHeaderRow: ViewStyle = {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    };
    const queueMetaRow: ViewStyle = {
      flexDirection: 'row',
      justifyContent: 'space-between',
    };
    const queueListGap: ViewStyle = { gap: spacing.sm };
    const rightColTitleRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    };
    const liveBadge: ViewStyle = {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainer,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      headerRow,
      pill,
      cardBorder,
      alertHeader,
      statTile,
      queueCard,
      twoCol,
      leftCol,
      rightCol,
      statRow,
      codeRow,
      inlineRowSm,
      inlineRowBaseline,
      queueHeaderRow,
      queueMetaRow,
      queueListGap,
      rightColTitleRow,
      liveBadge,
    };
  }, [colors, radii, spacing]);

  function openLiveOrders() {
    navigation.navigate('MerchantTabs', {
      screen: 'MerchantOrdersTab',
      params: { view: 'live-monitor' },
    });
  }

  async function submitVerification() {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      Alert.alert('Code required', "Enter the customer's verification code.");
      return;
    }
    setVerifying(true);
    try {
      // Try the entered code directly; the Stitch HTML shows 4 digits but reservation
      // codes are 6 alphanumeric characters in our system, so we pass through whatever
      // the merchant typed.
      const { error: verifyErr } = await authorizeHandoverByCode(trimmed);
      if (verifyErr) {
        Alert.alert('Could not verify', verifyErr);
        return;
      }
      Alert.alert('Handover complete', 'Order marked as collected.');
      setCode('');
      void loadQueue();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <StitchText variant="h1" colorKey="text">
            Rush hour operations
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
            {outletLabel} · Live monitoring
          </StitchText>
        </View>
        <View style={styles.pill}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Last updated: Just now
          </StitchText>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.primaryContainer} /> : null}
      {error ? (
        <StitchText variant="body-md" colorKey="error">
          {error}
        </StitchText>
      ) : null}

      <View style={styles.twoCol}>
        <View style={styles.leftCol}>
          {arrivalHero ? (
          <StitchSurface elevated padding="none" style={[styles.cardBorder, { borderLeftWidth: 3, borderLeftColor: colors.secondary }]}>
            <View style={styles.alertHeader}>
              <View style={styles.inlineRowSm}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.secondary,
                  }}
                />
                <StitchText variant="label-caps" colorKey="secondary">
                  {customerPickupSignalHeroLabel(arrivalHeroSignal) ?? 'Next pickup'}
                </StitchText>
              </View>
              <StitchText variant="label" colorKey="textMuted">
                {arrivalHero.order}
              </StitchText>
            </View>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {customerPickupSignalHeroSubcopy(arrivalHeroSignal) ?? 'Collecting'}
                </StitchText>
                <StitchText variant="display" colorKey="text" style={{ marginTop: 4 }}>
                  {arrivalHero.customer}
                </StitchText>
                <StitchText variant="body-lg" colorKey="text" style={{ marginTop: spacing.sm }}>
                  {arrivalHero.bag}
                </StitchText>
              </View>
              <View style={{ paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <StitchText variant="label" colorKey="text" style={{ marginBottom: spacing.sm }}>
                  Enter verification code
                </StitchText>
                <View style={styles.codeRow}>
                  <TextInput
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, '').slice(0, 6))}
                    placeholder="••••••"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    editable={!verifying}
                    style={{
                      flex: 1,
                      minHeight: 56,
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      backgroundColor: colors.surfaceBright,
                      textAlign: 'center',
                      fontSize: 28,
                      letterSpacing: 8,
                      color: colors.text,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={verifying}
                    onPress={() => {
                      void submitVerification();
                    }}
                    style={({ pressed }) => ({
                      justifyContent: 'center',
                      paddingHorizontal: spacing.lg,
                      borderRadius: radii.default,
                      backgroundColor: colors.primaryContainer,
                      opacity: pressed || verifying ? 0.88 : 1,
                    })}
                  >
                    {verifying ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <StitchText variant="label" colorKey="onPrimary">
                        Verify & handover
                      </StitchText>
                    )}
                  </Pressable>
                </View>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
                  {"Enter the 6-character code from the customer's order screen."}
                </StitchText>
                <Pressable
                  accessibilityRole="button"
                  onPress={openLiveOrders}
                  style={{ marginTop: spacing.xs }}
                >
                  <StitchText variant="label" colorKey="primaryContainer">
                    Open live orders →
                  </StitchText>
                </Pressable>
              </View>
            </View>
          </StitchSurface>
          ) : (
            <StitchSurface elevated padding="lg" style={styles.cardBorder}>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <StitchIcon name="person_outline" size={56} colorKey="textMuted" />
                <StitchText variant="h3" colorKey="text" style={{ textAlign: 'center' }}>
                  No customer waiting
                </StitchText>
                <StitchText
                  variant="body-md"
                  colorKey="textMuted"
                  style={{ textAlign: 'center' }}
                >
                  You'll see verification details here when a customer arrives.
                </StitchText>
              </View>
            </StitchSurface>
          )}

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <View style={[styles.inlineRowSm, { marginBottom: spacing.sm }]}>
                <StitchIcon name="shopping_bag" size={18} colorKey="textMuted" />
                <StitchText variant="label" colorKey="textMuted">
                  {"Today's rescues"}
                </StitchText>
              </View>
              <View style={styles.inlineRowBaseline}>
                <StitchText variant="display" colorKey="text">
                  {!loading ? String(stats.today_orders) : '—'}
                </StitchText>
                <StitchText variant="body-sm" colorKey="success">
                  orders
                </StitchText>
              </View>
            </View>
            <View style={styles.statTile}>
              <View style={[styles.inlineRowSm, { marginBottom: spacing.sm }]}>
                <StitchIcon name="inventory_2" size={18} colorKey="textMuted" />
                <StitchText variant="label" colorKey="textMuted">
                  Live listings
                </StitchText>
              </View>
              <View style={styles.inlineRowBaseline}>
                <StitchText variant="display" colorKey="text">
                  {!loading ? String(stats.active_bags) : '—'}
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  bags
                </StitchText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rightCol}>
          <View style={styles.rightColTitleRow}>
            <StitchText variant="h3" colorKey="text">
              Approaching pickups
            </StitchText>
            <View style={styles.liveBadge}>
              <StitchText variant="label-caps" colorKey="text">
                {queueLoading ? '—' : `${renderedQueue.length} live`}
              </StitchText>
            </View>
          </View>
          {queueError ? (
            <StitchText variant="body-sm" colorKey="error">
              {queueError}
            </StitchText>
          ) : null}
          {queueLoading ? (
            <ActivityIndicator color={colors.primaryContainer} />
          ) : renderedQueue.length === 0 ? (
            <StitchSurface elevated padding="md" style={styles.cardBorder}>
              <StitchText variant="label" colorKey="text">
                No upcoming pickups
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                Reservations with a pickup window inside the next 2 hours will appear here.
              </StitchText>
            </StitchSurface>
          ) : (
            <View style={styles.queueListGap}>
              {renderedQueue.map((q, i) => (
                <Pressable
                  key={q.id}
                  accessibilityRole="button"
                  onPress={openLiveOrders}
                  style={({ pressed }) => [
                    styles.queueCard,
                    { opacity: pressed ? 0.92 : 1 - i * 0.06 },
                  ]}
                >
                  <View style={styles.queueHeaderRow}>
                    <StitchText variant="label" colorKey="text">
                      {q.bag}
                    </StitchText>
                    <StitchText variant="price" colorKey={q.urgent ? 'secondary' : 'textMuted'}>
                      {q.eta}
                    </StitchText>
                  </View>
                  <View style={styles.queueMetaRow}>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {q.order}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {q.customer}
                    </StitchText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          refetch().catch(() => {});
          void loadQueue();
        }}
      >
        <StitchText variant="label" colorKey="primaryContainer">
          Refresh snapshot
        </StitchText>
      </Pressable>
    </StitchScreen>
  );
}
