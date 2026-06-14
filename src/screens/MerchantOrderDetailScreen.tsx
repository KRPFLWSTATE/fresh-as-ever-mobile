import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantShelves } from '@/hooks/useMerchantShelves';
import { useMerchantOrders } from '@/hooks/useMerchantOrders';
import { isOrderCollectible } from '@/domain/merchantOrderFilters';
import {
  isOrderIdUuidShape,
  isOrderEligibleForMerchantNoShow,
  normalizeOrderStatus,
} from '@/lib/orderStatus';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';
import { formatMerchantPickupWindow } from '@/domain/pickupWindow';
import { orderDisplayTitle, orderPickupWindow } from '@/lib/orderDisplay';

type OrderLineItem = {
  name_snapshot: string;
  quantity: number;
  shelf_item_id: string | null;
};

type OrderDetail = {
  id: string;
  group_id: string | null;
  shelf_id: string | null;
  order_items: OrderLineItem[];
  order_status: string | null;
  payment_status: string | null;
  total: number | null;
  reservation_code: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  bag_image_url: string | null;
  customer_name: string;
  customer_phone: string | null;
  bag_title: string;
  outlet_name: string;
  created_at: string | null;
};

function isPickupOverdue(endIso: string | null, normalizedStatus: string): boolean {
  if (!endIso) return false;
  if (['collected', 'cancelled'].includes(normalizedStatus)) return false;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}

function formatOrderBadge(row: Pick<OrderDetail, 'id' | 'reservation_code'>): string {
  if (row.reservation_code && row.reservation_code.length >= 3) {
    return `#${row.reservation_code.toUpperCase()}`;
  }
  const tail = row.id.replace(/-/g, '').slice(-4).toUpperCase();
  return `#${tail}`;
}

type CreateStylesArgs = {
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
};

function createStyles({ spacing, radii }: CreateStylesArgs) {
  return StyleSheet.create({
    scrollContent: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.pageMarginMobile,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    cardHero: {
      height: 128,
      width: '100%',
    },
    cardBody: {
      padding: spacing.md,
      flexGrow: 1,
      gap: spacing.xs,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto',
      paddingTop: spacing.md,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    primaryCtaInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 48,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
    },
  });
}

export function MerchantOrderDetailScreen() {
  const route =
    useRoute<RouteProp<RootStackParamList, 'MerchantOrderDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderId } = route.params;

  useLayoutEffect(() => {
    navigation.setOptions({ headerBackTitle: 'Orders' });
  }, [navigation]);
  const { env } = useAuthContext();
  const { outletScopeIds, loading: ctxLoading } = useMerchantContext(env);
  const { collectOrder } = useMerchantOrders(env);
  const { markShelfItemSoldOut } = useMerchantShelves(env, outletScopeIds[0] ?? null);
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(() => createStyles({ spacing, radii }), [spacing, radii]);

  const [row, setRow] = useState<OrderDetail | null>(null);
  const [groupBags, setGroupBags] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletScopeIds.length) {
      setRow(null);
      return;
    }
    const sb = getSupabase(env);
    const ref = String(orderId ?? '').trim();
    const uuid = isOrderIdUuidShape(ref);

    let q = sb
      .from('orders')
      .select(
        `
        id,
        group_id,
        order_status,
        payment_status,
        total,
        reservation_code,
        created_at,
        shelf_id,
        order_items(name_snapshot, quantity, shelf_item_id),
        shelf:clearance_shelves(pickup_start, pickup_end),
        customer:profiles(full_name, phone),
        bag:rescue_bags(title, image_url, pickup_start, pickup_end),
        outlet:outlets(name)
      `,
      )
      .in('outlet_id', outletScopeIds);

    q = uuid ? q.eq('id', ref) : q.eq('reservation_code', ref.toUpperCase());

    const { data, error: qErr } = await q.maybeSingle();

    if (qErr || !data) {
      setRow(null);
      setErr(qErr?.message ?? 'Order not found for your outlets.');
      return;
    }

    const o = data as Record<string, unknown>;
    const bag = o.bag as Record<string, unknown> | undefined;
    const shelf = o.shelf as Record<string, unknown> | undefined;
    const orderItems = Array.isArray(o.order_items)
      ? (o.order_items as Record<string, unknown>[])
      : [];
    const shelfId =
      o.shelf_id != null && String(o.shelf_id).length > 0
        ? String(o.shelf_id)
        : null;
    const pickup = orderPickupWindow({
      shelf_id: shelfId,
      bag: bag
        ? {
            pickup_start:
              typeof bag.pickup_start === 'string' ? bag.pickup_start : null,
            pickup_end:
              typeof bag.pickup_end === 'string' ? bag.pickup_end : null,
          }
        : null,
      shelf: shelf
        ? {
            pickup_start:
              typeof shelf.pickup_start === 'string' ? shelf.pickup_start : null,
            pickup_end:
              typeof shelf.pickup_end === 'string' ? shelf.pickup_end : null,
          }
        : null,
    });
    setErr(null);
    setRow({
      id: String(o.id),
      group_id: typeof o.group_id === 'string' ? o.group_id : null,
      shelf_id: shelfId,
      order_items: orderItems.map((item) => ({
        name_snapshot: String(item.name_snapshot ?? 'Item'),
        quantity: Number(item.quantity ?? 1),
        shelf_item_id:
          item.shelf_item_id != null && String(item.shelf_item_id).length > 0
            ? String(item.shelf_item_id)
            : null,
      })),
      order_status:
        typeof o.order_status === 'string' ? o.order_status : null,
      payment_status:
        typeof o.payment_status === 'string' ? o.payment_status : null,
      total: typeof o.total === 'number' ? o.total : Number(o.total ?? null),
      reservation_code:
        typeof o.reservation_code === 'string' ? o.reservation_code : null,
      pickup_start: pickup.start,
      pickup_end: pickup.end,
      bag_image_url:
        shelfId ? null : typeof bag?.image_url === 'string' ? bag.image_url : null,
      customer_name:
        String(
          (o.customer as Record<string, unknown> | undefined)?.full_name ?? '',
        ) || 'Customer',
      customer_phone: (() => {
        const v = (o.customer as Record<string, unknown> | undefined)?.phone;
        return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
      })(),
      bag_title: orderDisplayTitle({
        shelf_id: shelfId,
        bag: bag ? { title: typeof bag.title === 'string' ? bag.title : null } : null,
        order_items: orderItems.map((item) => ({
          name_snapshot:
            typeof item.name_snapshot === 'string' ? item.name_snapshot : null,
          quantity: typeof item.quantity === 'number' ? item.quantity : null,
        })),
      }),
      outlet_name: String((o.outlet as Record<string, unknown> | undefined)?.name ?? '') || 'Outlet',
      created_at:
        typeof o.created_at === 'string' ? o.created_at : null,
    });

    const groupId = typeof o.group_id === 'string' ? o.group_id : null;
    if (groupId) {
      const { data: siblings } = await sb
        .from('orders')
        .select('id, bag:rescue_bags(title)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      setGroupBags(
        (siblings ?? []).map((entry) => ({
          id: String((entry as { id: string }).id),
          title: String(
            ((entry as { bag?: { title?: string } }).bag?.title ?? 'Bag'),
          ),
        })),
      );
    } else {
      setGroupBags([]);
    }
  }, [env, orderId, outletScopeIds]);

  useEffect(() => {
    if (ctxLoading) {
      return;
    }
    load().catch((e) => logError(e, { context: 'MerchantOrderDetailScreen.load' }));
  }, [ctxLoading, load]);

  const normalized =
    row != null ? normalizeOrderStatus(row.order_status ?? '') : '';
  const rawStatus = String(row?.order_status ?? '').toLowerCase();
  const canHandover =
    row != null &&
    isOrderCollectible({
      status: normalized,
      order_status_raw: row.order_status,
      payment_status: row.payment_status,
    });

  const noShowEligible =
    row != null &&
    isOrderEligibleForMerchantNoShow(normalized, row.pickup_end);

  const overdue =
    row != null ? isPickupOverdue(row.pickup_end, normalized) : false;
  const pickupLine =
    row != null
      ? formatMerchantPickupWindow(row.pickup_start, row.pickup_end)
      : '';
  const scheduleColorKey = overdue ? 'error' : 'textMuted';
  const scheduleWeight: '400' | '600' | '700' = overdue ? '600' : '400';
  let scheduleDisplay = pickupLine;
  if (
    overdue &&
    row?.pickup_start &&
    row.pickup_end &&
    !Number.isNaN(new Date(row.pickup_start).getTime()) &&
    !Number.isNaN(new Date(row.pickup_end).getTime())
  ) {
    const start = new Date(row.pickup_start);
    const end = new Date(row.pickup_end);
    const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    scheduleDisplay = `Overdue: ${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
  }

  const orderedLabel = useMemo(() => {
    if (!row?.created_at) return null;
    const d = new Date(row.created_at);
    if (Number.isNaN(d.getTime())) return row.created_at;
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [row?.created_at]);

  async function onNoShow() {
    if (!row) return;
    setBusy(true);
    setErr(null);
    try {
      const sb = getSupabase(env);
      const { error: rpcError } = await sb.rpc('mark_order_no_show', {
        p_order_id: row.id,
      });
      if (rpcError) {
        throw new Error(rpcError.message ?? 'No-show RPC failed.');
      }
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No-show failed.';
      setErr(
        msg.includes('grace')
          ? 'Wait until 30 minutes after pickup end.'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  if (ctxLoading && !row) {
    return (
      <StitchScreen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      </StitchScreen>
    );
  }

  if (!row) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: styles.scrollContent }}>
        <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Order detail
        </StitchText>
        <StitchText variant="body-md" colorKey="error" style={{ marginBottom: spacing.md }}>
          {err ?? 'Unavailable.'}
        </StitchText>
        <StitchButton variant="secondary" title="Go back" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.scrollContent,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
        Order
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted" style={{ marginBottom: spacing.lg }}>
        {row.outlet_name}
      </StitchText>

      <StitchSurface
        elevated
        padding="none"
        style={{
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          overflow: 'hidden',
        }}
      >
        <View style={styles.cardHero}>
          {row.bag_image_url ? (
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={`${row.bag_title} thumbnail`}
              source={{ uri: row.bag_image_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.surface2 },
              ]}
            />
          )}
          <View
            style={{
              position: 'absolute',
              top: spacing.sm + 4,
              right: spacing.sm + 4,
              backgroundColor: `${colors.surface}E6`,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radii.default,
            }}
          >
            <StitchText variant="body-sm" colorKey="text" style={{ fontWeight: '700' }}>
              {formatOrderBadge(row)}
            </StitchText>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: spacing.sm,
            }}
          >
            <StitchText
              variant="h3"
              colorKey="onBackground"
              numberOfLines={2}
              style={{ flex: 1 }}
            >
              {row.bag_title}
            </StitchText>
            <StitchText variant="price" colorKey="accent">
              LKR {Number(row.total ?? 0).toLocaleString()}
            </StitchText>
          </View>
          <StitchText variant="body-sm" colorKey="textMuted">
            Customer: {row.customer_name}
          </StitchText>
          {row.shelf_id && row.order_items.length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Pick list
              </StitchText>
              {row.order_items.map((line, idx) => (
                <View
                  key={`${line.name_snapshot}-${idx}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radii.full,
                      backgroundColor: colors.primaryHighlight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <StitchText variant="label" colorKey="primaryContainer">
                      {line.quantity}
                    </StitchText>
                  </View>
                  <StitchText variant="body-md" colorKey="onBackground" style={{ flex: 1 }}>
                    {line.name_snapshot}
                  </StitchText>
                  {line.shelf_item_id ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        Alert.alert(
                          'Mark sold out',
                          `Mark "${line.name_snapshot}" as sold out on today's shelf?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Sold out',
                              style: 'destructive',
                              onPress: () => {
                                setBusy(true);
                                void markShelfItemSoldOut(line.shelf_item_id!)
                                  .then(() => Alert.alert('Updated', 'Item marked sold out.'))
                                  .catch((e) =>
                                    setErr(e instanceof Error ? e.message : 'Could not update.'),
                                  )
                                  .finally(() => setBusy(false));
                              },
                            },
                          ],
                        );
                      }}
                    >
                      <StitchText variant="label" colorKey="error">
                        Sold out
                      </StitchText>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {groupBags.length > 1 ? (
            <View style={{ marginTop: spacing.sm, gap: 4 }}>
              <StitchText variant="label-caps" colorKey="textMuted">
                Group order · {groupBags.length} bags
              </StitchText>
              {groupBags.map((bag) => (
                <StitchText key={bag.id} variant="body-sm" colorKey="text">
                  · {bag.title}
                </StitchText>
              ))}
            </View>
          ) : null}
          {row.customer_phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call customer at ${row.customer_phone}`}
              onPress={() => {
                const n = (row.customer_phone ?? '').replace(/\s/g, '');
                Linking.openURL(`tel:${n}`).catch(() => {
                  Alert.alert('Could not dial', `Tried ${row.customer_phone}.`);
                });
              }}
              style={({ pressed }) => ({
                marginTop: spacing.xs,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                Call {row.customer_phone}
              </StitchText>
            </Pressable>
          ) : (
            <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: spacing.xs }}>
              No phone number on customer profile.
            </StitchText>
          )}
          <StitchText variant="body-sm" colorKey="textMuted">
            Status: {normalized.replace(/_/g, ' ')}
          </StitchText>
          {rawStatus === 'disputed' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('MerchantDisputes')}
              style={({ pressed }) => ({
                marginTop: spacing.sm,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                View dispute in Disputes →
              </StitchText>
            </Pressable>
          ) : null}
          {noShowEligible ? (
            <StitchText variant="body-sm" colorKey="secondary">
              No-show eligible
            </StitchText>
          ) : null}
          <View
            style={[
              styles.cardFooter,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
              },
            ]}
          >
            <View style={styles.scheduleRow}>
              <StitchIcon name="schedule" size={16} colorKey={scheduleColorKey} />
              <StitchText
                variant="body-sm"
                colorKey={scheduleColorKey}
                style={{ flex: 1, fontWeight: scheduleWeight }}
              >
                {scheduleDisplay}
              </StitchText>
            </View>
          </View>
        </View>
      </StitchSurface>

      {orderedLabel ? (
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
          Ordered: {orderedLabel}
        </StitchText>
      ) : null}

      {err ? (
        <StitchText variant="body-md" colorKey="error" style={{ marginBottom: spacing.md }}>
          {err}
        </StitchText>
      ) : null}

      {canHandover ? (
        <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => navigation.navigate('MerchantScanHandover')}
            style={({ pressed }) => [
              styles.primaryCtaInner,
              {
                backgroundColor: colors.primaryContainer,
                opacity: pressed || busy ? 0.88 : 1,
              },
            ]}
          >
            <StitchIcon name="qr_code_scanner" size={20} colorKey="onPrimary" />
            <StitchText variant="label" colorKey="onPrimary">
              Scan QR for handover
            </StitchText>
          </Pressable>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
            Or enter the customer's 6-character code on the Orders tab.
          </StitchText>
          {row.reservation_code ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                if (!row.reservation_code) return;
                setBusy(true);
                void collectOrder(row.id, row.reservation_code).then((r) => {
                  setBusy(false);
                  if (r.error) {
                    setErr(r.error);
                    return;
                  }
                  navigation.goBack();
                });
              }}
              style={({ pressed }) => [
                styles.primaryCtaInner,
                {
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.primaryContainer,
                  opacity: pressed || busy ? 0.88 : 1,
                },
              ]}
            >
              <StitchIcon name="verified" size={20} colorKey="primaryContainer" />
              <StitchText variant="label" colorKey="primaryContainer">
                Verify code {row.reservation_code}
              </StitchText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {noShowEligible ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              'No-show',
              'Mark this order as no-show? Server enforces pickup window rules.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: () => void onNoShow() },
              ],
            )
          }
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            minHeight: 48,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 2,
            borderColor: colors.error,
            backgroundColor: 'transparent',
            opacity: pressed || busy ? 0.88 : 1,
            marginBottom: spacing.md,
          })}
        >
          <StitchIcon name="error" size={20} colorKey="error" />
          <StitchText variant="label" colorKey="error">
            Mark no-show
          </StitchText>
        </Pressable>
      ) : null}

      <StitchButton variant="secondary" title="Back to orders" onPress={() => navigation.goBack()} />
    </StitchScreen>
  );
}
