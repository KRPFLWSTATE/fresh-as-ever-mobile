import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  CustomerTabParamList,
  RootStackParamList,
} from '@/navigation/types';
import { getSupabase } from '@/lib/supabase';
import { useAuthContext } from '@/context/AuthContext';
import {
  ACTIVE_ORDER_STATUSES,
  normalizeOrderStatus,
} from '@/lib/orderStatus';
import { isCustomerArchivedOrderVisible } from '@/lib/customerRescueMetrics';
import { orderDisplayTitle, orderPickupWindow } from '@/lib/orderDisplay';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchFonts } from '@/theme/stitchTokens';
import { StitchCard, StitchIcon, StitchText } from '@/ui/stitch';

type BagJoin = {
  title?: string | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
} | null;

type OutletJoin = {
  name?: string | null;
  merchant?: { business_name?: string | null } | null;
} | null;

type OrderItemRow = {
  name_snapshot?: string | null;
  quantity?: number | null;
};

type ShelfJoin = {
  pickup_start?: string | null;
  pickup_end?: string | null;
} | null;

type OrderRow = {
  id: string;
  order_status: string | null;
  total: number | null;
  created_at: string | null;
  reservation_code: string | null;
  customer_arrived_at: string | null;
  shelf_id: string | null;
  order_items: OrderItemRow[] | null;
  bag: BagJoin;
  shelf: ShelfJoin;
  outlet: OutletJoin;
};

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'OrdersTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return '—';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
}

function formatOrderRef(id: string, reservationCode: string | null | undefined): string {
  const rc = reservationCode?.trim();
  if (rc) return `#FAE-${rc}`;
  const tail = id.replace(/-/g, '').slice(-6).toUpperCase();
  return `#FAE-${tail}`;
}

function formatHistoryDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (d.toDateString() === now.toDateString()) return 'Today';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusPresentation(normalized: string): {
  label: string;
  tone: 'success' | 'neutral' | 'muted';
} {
  switch (normalized) {
    case 'ready_for_pickup':
      return { label: 'Ready for Pickup', tone: 'success' };
    case 'paid':
      return { label: 'Preparing', tone: 'neutral' };
    case 'reserved':
      return { label: 'Reserved', tone: 'muted' };
    default:
      return {
        label: normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        tone: 'neutral',
      };
  }
}

export function OrdersScreen() {
  const navigation = useNavigation<Nav>();
  const { env, session } = useAuthContext();
  const { colors, spacing, radii, ambientShadow } = useStitchTheme();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<'active' | 'archived'>('active');
  const hasLoadedOnceRef = useRef(false);

  const styles = useMemo(
    () => createStyles({ spacing, radii }),
    [spacing, radii],
  );

  const load = useCallback(async (mode: 'full' | 'refresh' = 'full') => {
    const sb = getSupabase(env);
    const uid = session?.user.id;
    if (!uid) {
      setRows([]);
      hasLoadedOnceRef.current = false;
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (!hasLoadedOnceRef.current) {
      setLoading(true);
    }
    const { data, error } = await sb
      .from('orders')
      .select(
        `
          id,
          order_status,
          total,
          created_at,
          reservation_code,
          customer_arrived_at,
          shelf_id,
          order_items(name_snapshot, quantity),
          shelf:clearance_shelves(pickup_start, pickup_end),
          bag:rescue_bags(title, pickup_start, pickup_end),
          outlet:outlets(name, merchant:merchants(business_name))
        `,
      )
      .eq('customer_id', uid)
      .order('created_at', { ascending: false })
      .limit(80);

    if (mode === 'refresh') {
      setRefreshing(false);
    } else {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
    if (error) {
      setRows([]);
      return;
    }
    setRows((data as OrderRow[]) ?? []);
  }, [env, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      navigation.getParent()?.navigate('Login');
      return;
    }
    void load();
  }, [load, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      void load('refresh');
    }, [load, session?.user.id]),
  );

  const filtered = rows.filter((r) => {
    const n = normalizeOrderStatus(r.order_status);
    const active = ACTIVE_ORDER_STATUSES.includes(
      n as (typeof ACTIVE_ORDER_STATUSES)[number],
    );
    if (segment === 'active') return active;
    return isCustomerArchivedOrderVisible(r.order_status);
  });

  const renderActiveCard = (item: OrderRow) => {
    const bag = item.bag;
    const outlet = item.outlet;
    const venue =
      typeof outlet?.merchant?.business_name === 'string' && outlet.merchant.business_name
        ? outlet.merchant.business_name
        : typeof outlet?.name === 'string'
          ? outlet.name
          : '';
    const title = orderDisplayTitle({
      shelf_id: item.shelf_id,
      bag,
      order_items: item.order_items,
    });
    const pickup = orderPickupWindow({
      shelf_id: item.shelf_id,
      bag,
      shelf: item.shelf,
    });
    const pickupLine = formatPickupWindow(pickup.start, pickup.end);
    const normalized = normalizeOrderStatus(item.order_status);
    const stat = statusPresentation(normalized);
    const badgeBg =
      stat.tone === 'success'
        ? colors.primaryHighlight
        : stat.tone === 'muted'
          ? colors.surfaceContainerHighest
          : colors.surfaceContainerHigh;
    const badgeFg =
      stat.tone === 'success' ? colors.success : colors.textMuted;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.getParent()?.navigate('OrderDetail', {
            orderId: item.id,
          })
        }
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <StitchCard style={{ marginBottom: spacing.md }}>
          <View style={styles.activeCardInner}>
            <View
              style={[
                styles.iconTile,
                { backgroundColor: colors.primaryHighlight },
              ]}
            >
              <StitchIcon name="qr_code_scanner" size={28} colorKey="primaryContainer" />
            </View>
            <View style={styles.activeMain}>
              <View style={styles.chipRow}>
                <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                  <StitchText
                    variant="body-sm"
                    style={{
                      color: badgeFg,
                      fontSize: 10,
                      fontFamily: stitchFonts.bold,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat.label.toUpperCase()}
                  </StitchText>
                </View>
                <StitchText variant="label-caps" colorKey="textFaint">
                  {formatOrderRef(item.id, item.reservation_code)}
                </StitchText>
              </View>
              <StitchText variant="h3" colorKey="onSurface" style={{ marginBottom: 4 }}>
                {title}
              </StitchText>
              {venue ? (
                <View style={styles.storeRow}>
                  <StitchIcon name="storefront" size={16} colorKey="textMuted" />
                  <StitchText variant="body-sm" colorKey="textMuted" style={{ marginLeft: 4 }}>
                    {venue}
                  </StitchText>
                </View>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.pickupPanel,
              {
                borderColor: colors.outlineVariant,
                backgroundColor: colors.surfaceContainerLowest,
              },
            ]}
          >
            <StitchText variant="label-caps" colorKey="textMuted" style={{ marginBottom: 4 }}>
              Pickup Window
            </StitchText>
            <View style={styles.pickupRow}>
              <StitchIcon name="schedule" size={18} colorKey="onSurface" />
              <StitchText variant="body-md" colorKey="onSurface" style={{ marginLeft: 4 }}>
                {pickupLine}
              </StitchText>
            </View>
            {item.customer_arrived_at ? (
              <StitchText variant="body-sm" colorKey="secondary" style={{ marginTop: spacing.xs }}>
                Outlet notified — you're here. Open order for your code or QR.
              </StitchText>
            ) : null}
          </View>
        </StitchCard>
      </Pressable>
    );
  };

  const renderArchivedCard = (item: OrderRow) => {
    const bag = item.bag;
    const outlet = item.outlet;
    const venue =
      typeof outlet?.merchant?.business_name === 'string' && outlet.merchant.business_name
        ? outlet.merchant.business_name
        : typeof outlet?.name === 'string'
          ? outlet.name
          : 'Store';
    const title = orderDisplayTitle({
      shelf_id: item.shelf_id,
      bag,
      order_items: item.order_items,
    });
    const when = formatHistoryDate(item.created_at);
    const normalized = normalizeOrderStatus(item.order_status);
    const statusLabel =
      normalized === 'collected'
        ? 'Collected'
        : normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.getParent()?.navigate('OrderDetail', {
            orderId: item.id,
          })
        }
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 0.8 }]}
      >
        <View
          style={[
            styles.archivedCard,
            {
              backgroundColor: colors.surface2,
              marginBottom: spacing.md,
              borderRadius: radii.xl,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.archivedRow}>
            <View
              style={[
                styles.archivedIcon,
                {
                  borderColor: colors.outlineVariant,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <StitchIcon name="check_circle" size={28} colorKey="success" />
            </View>
            <View style={{ flex: 1 }}>
              <StitchText
                variant="body-md"
                colorKey="onSurface"
                style={{ fontFamily: stitchFonts.semiBold }}
              >
                {title}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {when ? `${venue} • ${when}` : venue}
              </StitchText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <StitchText variant="label" colorKey="success">
                {statusLabel}
              </StitchText>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (!session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <StitchText variant="body-md" colorKey="onSurface">
          Sign in to see orders.
        </StitchText>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryContainer} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      data={filtered}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: spacing.pageMarginMobile }}>
          <View style={{ marginBottom: spacing.lg, marginTop: spacing.sm }}>
            <StitchText variant="h1" colorKey="onSurface">
              Orders
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
              Manage your rescues and pickups.
            </StitchText>
          </View>
          <View
            style={[
              styles.segmentShell,
              {
                backgroundColor: colors.surfaceContainer,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.outlineVariant,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setSegment('active')}
              style={({ pressed }) => [
                styles.segmentBtn,
                segment === 'active'
                  ? {
                      backgroundColor: colors.surface,
                      ...ambientShadow,
                      opacity: pressed ? 0.95 : 1,
                    }
                  : { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <StitchText
                variant="label"
                colorKey={segment === 'active' ? 'onSurface' : 'textMuted'}
              >
                Active
              </StitchText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSegment('archived')}
              style={({ pressed }) => [
                styles.segmentBtn,
                segment === 'archived'
                  ? {
                      backgroundColor: colors.surface,
                      ...ambientShadow,
                      opacity: pressed ? 0.95 : 1,
                    }
                  : { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <StitchText
                variant="label"
                colorKey={segment === 'archived' ? 'onSurface' : 'textMuted'}
              >
                Archived
              </StitchText>
            </Pressable>
          </View>
          {segment === 'archived' ? (
            <View style={{ paddingBottom: spacing.md }}>
              <StitchText variant="h2" colorKey="onSurface">
                Recent History
              </StitchText>
            </View>
          ) : null}
        </View>
      }
      contentContainerStyle={
        filtered.length === 0
          ? [styles.empty, { paddingHorizontal: spacing.pageMarginMobile }]
          : {
              paddingBottom: spacing.xl,
              flexGrow: 1,
              paddingHorizontal: spacing.pageMarginMobile,
            }
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: spacing.pageMarginMobile }}>
          <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
            {rows.length === 0
              ? 'No orders yet.'
              : segment === 'active'
                ? 'No active orders.'
                : 'No archived orders.'}
          </StitchText>
        </View>
      }
      refreshing={refreshing}
      onRefresh={() => void load('refresh')}
      renderItem={({ item }) =>
        segment === 'active' ? renderActiveCard(item) : renderArchivedCard(item)
      }
    />
  );
}

function createStyles({
  spacing,
  radii,
}: {
  spacing: typeof import('@/theme/stitchTokens').stitchSpacing;
  radii: typeof import('@/theme/stitchTokens').stitchRadii;
}) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    segmentShell: {
      flexDirection: 'row',
      borderRadius: radii.lg,
      padding: spacing.xs,
      gap: 0,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.default,
    },
    empty: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    activeCardInner: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeMain: {
      flex: 1,
      minWidth: 0,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
      marginBottom: spacing.xs,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.default,
    },
    storeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    pickupPanel: {
      marginTop: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignSelf: 'stretch',
    },
    pickupRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    archivedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    archivedIcon: {
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    archivedCard: {},
  });
}
