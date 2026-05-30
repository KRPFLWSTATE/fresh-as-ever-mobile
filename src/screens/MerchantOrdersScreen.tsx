import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  MerchantTabParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import {
  MERCHANT_ORDERS_VIEW_LABELS,
  useMerchantOrders,
  type HandoverLookupResult,
} from '@/hooks/useMerchantOrders';
import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';
import {
  MERCHANT_ORDERS_VIEWS,
  parseMerchantOrdersView,
} from '@/domain/merchantOrdersView';
import {
  filterLateBySeverity,
  isLateHandoverEligible,
  isNoShowEligible,
  lateSeverityCounts,
  sortLateOrders,
} from '@/domain/merchantOrderFilters';
import { lateSeverityFromMinutes, minutesPastPickupEnd } from '@/domain/pickupWindow';
import {
  countPickupWindowHandovers,
  countVerificationHandovers,
} from '@/lib/merchantHandoverCounts';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchCard,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import { logError } from '@/observability/logError';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MerchantTabParamList, 'MerchantOrdersTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatMerchantPickupWindow(
  startIso: string | null,
  endIso: string | null,
): string {
  if (!startIso || !endIso) return 'Pickup time TBC';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Pickup time TBC';
  }
  const now = new Date();
  let dayLabel: string;
  if (start.toDateString() === now.toDateString()) {
    dayLabel = 'Today';
  } else {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dayLabel =
      start.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${dayLabel}, ${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
}

function isPickupOverdue(endIso: string | null, normalizedStatus: string): boolean {
  if (!endIso) return false;
  if (['collected', 'cancelled'].includes(normalizedStatus)) return false;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}

function formatOrderBadge(item: MerchantOrderRow): string {
  if (item.reservation_code && item.reservation_code.length >= 3) {
    return `#${item.reservation_code.toUpperCase()}`;
  }
  const tail = item.id.replace(/-/g, '').slice(-4).toUpperCase();
  return `#${tail}`;
}

function customerPhoneDisplay(phone: string | null | undefined): string {
  return (phone ?? '').trim();
}

type CreateStylesArgs = {
  spacing: ReturnType<typeof useStitchTheme>['spacing'];
  radii: ReturnType<typeof useStitchTheme>['radii'];
};

function createStyles({ spacing, radii }: CreateStylesArgs) {
  return StyleSheet.create({
    flexOne: { flex: 1 },
    listContent: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.pageMarginMobile,
    },
    center: { padding: spacing.xl, alignItems: 'center' },
    verifyRow: {
      flexDirection: 'column',
      gap: spacing.sm,
    },
    verifyInputRow: {
      flexDirection: 'column',
      gap: spacing.sm,
    },
    pendingAside: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.lg,
      marginTop: spacing.lg,
    },
    tabRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md,
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
    lateHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    lateFiltersRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    lateCardBody: {
      padding: spacing.md,
      gap: spacing.md,
    },
    lateMetaTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    lateCustomerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    lateFooterButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
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

function VerifyHandoverCard({
  pendingCount,
  verificationTotal,
  onLookup,
  onCollectGroup,
  onCollectOrder,
  onScanQr,
}: {
  pendingCount: number;
  verificationTotal: number;
  onLookup: (code: string) => Promise<HandoverLookupResult>;
  onCollectGroup: (groupId: string, code: string) => Promise<{ error?: string }>;
  onCollectOrder: (orderId: string, code: string) => Promise<{ error?: string }>;
  onScanQr: () => void;
}): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(() => createStyles({ spacing, radii }), [spacing, radii]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [groupPreview, setGroupPreview] = useState<Extract<
    HandoverLookupResult,
    { type: 'group' }
  > | null>(null);

  const finishHandover = useCallback(
    (result: { error?: string }) => {
      if (result.error) {
        Alert.alert('Could not authorize', result.error);
        return;
      }
      setCode('');
      setGroupPreview(null);
      Alert.alert('Handover complete', 'Order marked as collected.');
    },
    [],
  );

  const submit = useCallback(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Verification code', "Enter the customer's 6-character code.");
      return;
    }
    setBusy(true);
    onLookup(trimmed)
      .then((lookup) => {
        if ('error' in lookup) {
          Alert.alert('Could not authorize', lookup.error);
          return;
        }
        if (lookup.type === 'group' && lookup.bags.length > 1) {
          setGroupPreview(lookup);
          return;
        }
        if (lookup.type === 'group') {
          return onCollectGroup(lookup.groupId, lookup.code).then(finishHandover);
        }
        return onCollectOrder(lookup.orderId, lookup.code).then(finishHandover);
      })
      .catch(() => {
        Alert.alert('Could not authorize', 'Something went wrong. Try again.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [code, onLookup, onCollectGroup, onCollectOrder, finishHandover]);

  const confirmGroupCollect = useCallback(() => {
    if (!groupPreview) return;
    setBusy(true);
    onCollectGroup(groupPreview.groupId, groupPreview.code)
      .then(finishHandover)
      .catch(() => {
        Alert.alert('Could not authorize', 'Something went wrong. Try again.');
      })
      .finally(() => {
        setBusy(false);
      });
  }, [groupPreview, onCollectGroup, finishHandover]);

  return (
    <StitchCard style={{ marginBottom: spacing.lg }}>
      <View style={styles.verifyRow}>
        <View style={{ flex: 1 }}>
          <StitchText variant="h2" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
            Verify Customer Code
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.md }}>
            Enter the 6-character code from the customer's order to authorize handover.
          </StitchText>
          <View style={styles.verifyInputRow}>
            <TextInput
              accessibilityLabel="Verification code"
              value={code}
              placeholder="e.g. 849201"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              maxLength={6}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, '').slice(0, 6))}
              editable={!busy}
              style={{
                width: '100%',
                minHeight: 48,
                paddingHorizontal: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                fontSize: 16,
                letterSpacing: 3.2,
                color: colors.onBackground,
                backgroundColor: colors.surface,
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryCtaInner,
                {
                  backgroundColor: colors.primaryContainer,
                  opacity: pressed || busy ? 0.88 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <StitchIcon name="verified" size={20} colorKey="onPrimary" />
                  <StitchText variant="label" colorKey="onPrimary">
                    Authorize Handover
                  </StitchText>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onScanQr}
              style={({ pressed }) => [
                styles.primaryCtaInner,
                {
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  opacity: pressed || busy ? 0.88 : 1,
                },
              ]}
            >
              <StitchIcon name="qr_code_scanner" size={20} colorKey="primaryContainer" />
              <StitchText variant="label" colorKey="primaryContainer">
                Scan QR
              </StitchText>
            </Pressable>
          </View>
        </View>
        <View
          style={[
            styles.pendingAside,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.divider,
            },
          ]}
        >
          <StitchText variant="display" colorKey="primaryContainer" style={{ marginBottom: 2 }}>
            {pendingCount}
          </StitchText>
          <StitchText variant="label-caps" colorKey="textMuted">
            Due in next 2h
          </StitchText>
          {verificationTotal > pendingCount ? (
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4, textAlign: 'center' }}>
              {verificationTotal} active handovers total
            </StitchText>
          ) : null}
        </View>
      </View>
      <Modal
        visible={groupPreview != null}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupPreview(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setGroupPreview(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
              gap: spacing.sm,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <StitchText variant="h3" colorKey="text">
              Group pickup ({groupPreview?.bagCount ?? 0} bags)
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              {groupPreview?.customerName}
            </StitchText>
            {groupPreview?.bags.map((bag) => (
              <View
                key={bag.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              >
                <StitchIcon name="check_circle" size={18} colorKey="primary" />
                <StitchText variant="body-md" colorKey="text">
                  {bag.title}
                </StitchText>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={confirmGroupCollect}
              style={({ pressed }) => [
                styles.primaryCtaInner,
                {
                  backgroundColor: colors.primaryContainer,
                  marginTop: spacing.md,
                  opacity: pressed || busy ? 0.88 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <StitchText variant="label" colorKey="onPrimary">
                  Collect all {groupPreview?.bagCount ?? 0} bags
                </StitchText>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </StitchCard>
  );
}

export function MerchantOrdersScreen() {
  const route =
    useRoute<RouteProp<MerchantTabParamList, 'MerchantOrdersTab'>>();
  const { env } = useAuthContext();
  const navigation = useNavigation<Nav>();
  const view = parseMerchantOrdersView(route.params?.view);
  const { colors, spacing, radii } = useStitchTheme();

  const {
    orders,
    visibleOrders,
    loading,
    error,
    refetch,
    lookupHandoverByCode,
    collectGroupHandover,
    collectOrder,
    authorizeHandoverByCode,
    markNoShow,
  } = useMerchantOrders(env, view);

  const styles = useMemo(() => createStyles({ spacing, radii }), [spacing, radii]);

  const [actionSheet, setActionSheet] = useState<MerchantOrderRow | null>(null);
  const [lateChip, setLateChip] = useState<'all' | 'critical' | 'moderate' | 'recent'>('all');
  const [lateVerifyOrder, setLateVerifyOrder] = useState<MerchantOrderRow | null>(null);
  const [lateVerifyCode, setLateVerifyCode] = useState('');

  const callCustomer = useCallback((item: MerchantOrderRow) => {
    const num = (item.customer_phone ?? '').replace(/\s/g, '');
    if (!num) {
      Alert.alert(
        'No phone on file',
        `${item.customer_name} has not added a phone number to their profile.`,
      );
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => {
      Alert.alert('Could not dial', `Tried ${num}.`);
    });
  }, []);

  const pendingHandoverCount = useMemo(
    () => countPickupWindowHandovers(orders),
    [orders],
  );
  const verificationHandoverCount = useMemo(
    () => countVerificationHandovers(orders),
    [orders],
  );
  const lateCounts = useMemo(() => lateSeverityCounts(visibleOrders), [visibleOrders]);

  const listData = useMemo(() => {
    if (view !== 'late-pickups') return visibleOrders;
    return filterLateBySeverity(sortLateOrders(visibleOrders), lateChip);
  }, [view, visibleOrders, lateChip]);

  const openOrderActions = useCallback((item: MerchantOrderRow) => {
    setActionSheet(item);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MerchantOrderRow }) => {
      const overdue = isPickupOverdue(item.pickup_end, item.status);
      const pickupLine = formatMerchantPickupWindow(
        item.pickup_start,
        item.pickup_end,
      );
      const scheduleColorKey = overdue ? 'error' : 'textMuted';
      const scheduleWeight: '400' | '600' | '700' = overdue ? '600' : '400';
      let overdueLine = pickupLine;
      if (overdue && item.pickup_start && item.pickup_end) {
        const start = new Date(item.pickup_start);
        const end = new Date(item.pickup_end);
        const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          overdueLine = `Overdue: ${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
        }
      }

      if (view === 'late-pickups') {
        const minsLate = minutesPastPickupEnd(Date.now(), item.pickup_end);
        const sev = lateSeverityFromMinutes(minsLate);
        const lateLabel = minsLate > 0 ? `${minsLate}m LATE` : 'LATE';
        const canHandover = isLateHandoverEligible(item);
        const canNoShow = isNoShowEligible(item);
        const dueAt = item.pickup_end
          ? new Date(item.pickup_end).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'TBC';
        const accent =
          sev === 'critical' ? colors.accent : colors.secondaryContainer;
        return (
          <View style={{ marginBottom: spacing.md }}>
            <StitchSurface
              elevated
              padding="none"
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderLeftWidth: 4,
                borderLeftColor: accent,
                overflow: 'hidden',
              }}
            >
              <View style={styles.lateCardBody}>
                <View style={styles.lateMetaTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: radii.default,
                        backgroundColor: `${accent}22`,
                      }}
                    >
                      <StitchText
                        variant="label-caps"
                        colorKey={sev === 'critical' ? 'accent' : 'secondary'}
                      >
                        {lateLabel}
                      </StitchText>
                    </View>
                    <StitchText variant="label" colorKey="textMuted">
                      Code: {formatOrderBadge(item).replace('#', '')}
                    </StitchText>
                  </View>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Due {dueAt}
                  </StitchText>
                </View>
                <View style={styles.lateCustomerRow}>
                  <View style={{ flex: 1 }}>
                    <StitchText variant="h3" colorKey="text" numberOfLines={1}>
                      {item.bag_title}
                    </StitchText>
                    <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 2 }}>
                      Customer: {item.customer_name}
                    </StitchText>
                  </View>
                  <StitchText variant="price" colorKey="accent">
                    LKR {Number(item.total ?? 0).toLocaleString()}
                  </StitchText>
                </View>
              </View>
              <View
                style={[
                  styles.lateFooterButtons,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.divider,
                    backgroundColor: colors.surfaceBright,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${item.customer_name}`}
                  onPress={() => callCustomer(item)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    borderRadius: radii.lg,
                    borderWidth: 1.5,
                    borderColor: colors.primaryContainer,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.xs,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <StitchText variant="label" colorKey="primaryContainer">
                    Call customer
                  </StitchText>
                  {customerPhoneDisplay(item.customer_phone) ? (
                    <StitchText
                      variant="body-sm"
                      colorKey="textMuted"
                      numberOfLines={1}
                      style={{ marginTop: 2, textAlign: 'center' }}
                    >
                      {customerPhoneDisplay(item.customer_phone)}
                    </StitchText>
                  ) : null}
                </Pressable>
                {canHandover ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setLateVerifyOrder(item);
                      setLateVerifyCode('');
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 44,
                      borderRadius: radii.lg,
                      backgroundColor: colors.primaryContainer,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <StitchText variant="label" colorKey="onPrimary">
                      Verify pickup
                    </StitchText>
                  </Pressable>
                ) : null}
                {canHandover ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.getParent()?.navigate('MerchantScanHandover')
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 44,
                      borderRadius: radii.lg,
                      borderWidth: 1.5,
                      borderColor: colors.primaryContainer,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <StitchText variant="label" colorKey="primaryContainer">
                      Scan QR
                    </StitchText>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={!canNoShow}
                  onPress={() => {
                    if (!canNoShow) return;
                    Alert.alert(
                      'Report no-show',
                      `Mark ${formatOrderBadge(item)} as no-show after the grace period?`,
                      [
                        { text: 'Keep order', style: 'cancel' },
                        {
                          text: 'Report no-show',
                          style: 'destructive',
                          onPress: () => {
                            markNoShow(item.id).then((r) => {
                              if (r.error) Alert.alert('No-show', r.error);
                            });
                          },
                        },
                      ],
                    );
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 44,
                    borderRadius: radii.lg,
                    backgroundColor: colors.surfaceContainer,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: canNoShow && !pressed ? 1 : 0.45,
                  })}
                >
                  <StitchText variant="label" colorKey="error">
                    {canNoShow ? 'Report no-show' : 'No-show in 30m'}
                  </StitchText>
                </Pressable>
              </View>
            </StitchSurface>
          </View>
        );
      }

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.getParent()?.navigate('MerchantOrderDetail', {
              orderId: item.id,
            })
          }
          style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1, marginBottom: spacing.md }]}
        >
          <StitchSurface
            elevated
            padding="none"
            style={{
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              overflow: 'hidden',
            }}
          >
            <View style={styles.cardHero}>
              {item.bag_image_url ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${item.bag_title} thumbnail`}
                  source={{ uri: item.bag_image_url }}
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
                  {formatOrderBadge(item)}
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
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {item.bag_title}
                </StitchText>
                <StitchText variant="price" colorKey="accent">
                  LKR {Number(item.total ?? 0).toLocaleString()}
                </StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted">
                Customer: {item.customer_name}
              </StitchText>
              {item.no_show_available ? (
                <StitchText variant="body-sm" colorKey="secondary">
                  No-show eligible
                </StitchText>
              ) : null}
              <StitchText variant="body-sm" colorKey="textMuted">
                Status: {item.status.replace(/_/g, ' ')}
              </StitchText>
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
                    numberOfLines={2}
                    style={{ fontWeight: scheduleWeight, flex: 1 }}
                  >
                    {overdue ? overdueLine : pickupLine}
                  </StitchText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Order actions"
                  onPress={() => openOrderActions(item)}
                  style={({ pressed }) => ({
                    padding: spacing.sm,
                    borderRadius: 999,
                    backgroundColor: pressed ? colors.primaryHighlight : 'transparent',
                  })}
                >
                  <StitchIcon name="more_vert" size={22} colorKey="primaryContainer" />
                </Pressable>
              </View>
            </View>
          </StitchSurface>
        </Pressable>
      );
    },
    [
      callCustomer,
      colors.accent,
      colors.divider,
      colors.outlineVariant,
      colors.primaryHighlight,
      colors.primaryContainer,
      colors.secondaryContainer,
      colors.surfaceBright,
      colors.surfaceContainer,
      colors.surface,
      colors.surface2,
      navigation,
      openOrderActions,
      radii.default,
      radii.lg,
      markNoShow,
      spacing.md,
      spacing.sm,
      spacing.xs,
      styles.cardBody,
      styles.cardFooter,
      styles.cardHero,
      styles.lateCardBody,
      styles.lateCustomerRow,
      styles.lateFooterButtons,
      styles.lateMetaTop,
      styles.scheduleRow,
      view,
    ],
  );

  const tabRow = useMemo(
    () => (
      <View
        style={[
          styles.tabRow,
          {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        {MERCHANT_ORDERS_VIEWS.map((opt) => {
          const active = opt === view;
          const label = MERCHANT_ORDERS_VIEW_LABELS[opt].title;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => navigation.navigate('MerchantOrdersTab', { view: opt })}
              style={{
                paddingVertical: spacing.sm + 4,
                paddingHorizontal: spacing.md,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: active ? colors.primaryContainer : 'transparent',
                marginBottom: -StyleSheet.hairlineWidth,
              }}
            >
              <StitchText
                variant="label"
                colorKey={active ? 'primaryContainer' : 'textMuted'}
                numberOfLines={1}
              >
                {label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>
    ),
    [colors.divider, colors.primaryContainer, navigation, styles.tabRow, spacing, view],
  );

  const header = useMemo(
    () => (
      <>
        <StitchText variant="h1" colorKey="onBackground" style={{ marginBottom: spacing.xs }}>
          Orders
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginBottom: spacing.lg }}>
          Manage handovers and verify customer pickups.
        </StitchText>

        <VerifyHandoverCard
          pendingCount={pendingHandoverCount}
          verificationTotal={verificationHandoverCount}
          onLookup={lookupHandoverByCode}
          onCollectGroup={collectGroupHandover}
          onCollectOrder={collectOrder}
          onScanQr={() => navigation.getParent()?.navigate('MerchantScanHandover')}
        />

        {tabRow}

        <StitchText variant="h3" colorKey="onBackground" style={{ marginBottom: 4 }}>
          {MERCHANT_ORDERS_VIEW_LABELS[view].title}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginBottom: spacing.sm }}>
          {MERCHANT_ORDERS_VIEW_LABELS[view].subtitle}
        </StitchText>
        {view === 'late-pickups' ? (
          <>
            <View style={styles.lateHeaderRow}>
              <StitchText variant="body-sm" colorKey="textMuted">
                Orders past their scheduled collection window.
              </StitchText>
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  alignItems: 'center',
                }}
              >
                <StitchText variant="h2" colorKey="accent">
                  {visibleOrders.length}
                </StitchText>
                <StitchText variant="label-caps" colorKey="textMuted">
                  URGENT
                </StitchText>
              </View>
            </View>
            <View style={styles.lateFiltersRow}>
              {(
                [
                  { id: 'all' as const, label: `All (${lateCounts.total})` },
                  {
                    id: 'critical' as const,
                    label: `Critical (${lateCounts.critical})`,
                  },
                  {
                    id: 'moderate' as const,
                    label: `Late (${lateCounts.moderate})`,
                  },
                  {
                    id: 'recent' as const,
                    label: `Just late (${lateCounts.recent})`,
                  },
                ] as const
              ).map((chip) => {
                const active = lateChip === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setLateChip(chip.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      backgroundColor: active ? colors.accentHighlight : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? `${colors.accent}33` : colors.divider,
                    }}
                  >
                    <StitchText
                      variant="label"
                      colorKey={active ? 'accent' : 'textMuted'}
                    >
                      {chip.label}
                    </StitchText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        {error ? (
          <StitchText variant="body-sm" colorKey="error" style={{ marginBottom: spacing.sm }}>
            {error}
          </StitchText>
        ) : null}
      </>
    ),
    [
      authorizeHandoverByCode,
      colors.accent,
      colors.accentHighlight,
      colors.divider,
      colors.surface,
      error,
      lateChip,
      lateCounts,
      navigation,
      pendingHandoverCount,
      verificationHandoverCount,
      radii.full,
      radii.lg,
      spacing,
      tabRow,
      view,
      visibleOrders.length,
      styles.lateFiltersRow,
      styles.lateHeaderRow,
    ],
  );

  return (
    <StitchScreen edges={['top', 'left', 'right']}>
      {loading && listData.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      ) : null}
      <FlatList
        data={listData}
        keyExtractor={(i) => i.id}
        style={styles.flexOne}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && listData.length > 0}
            onRefresh={() => {
              refetch().catch((err) => logError(err, { context: 'MerchantOrdersScreen.refetch' }));
            }}
            tintColor={colors.primaryContainer}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading ? (
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              {view === 'late-pickups'
                ? lateChip === 'all'
                  ? 'No late pickups right now. Orders appear here after their pickup window ends.'
                  : 'No orders in this severity bucket.'
                : 'No orders match this view.'}
            </StitchText>
          ) : null
        }
        renderItem={renderItem}
      />

      <Modal
        transparent
        visible={actionSheet != null}
        animationType="fade"
        onRequestClose={() => setActionSheet(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setActionSheet(null)}
          style={{
            flex: 1,
            backgroundColor: `${colors.inverseSurface}66`,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing.xs }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.outlineVariant,
                }}
              />
            </View>
            {actionSheet ? (
              <>
                <StitchText variant="label-caps" colorKey="textMuted">
                  {formatOrderBadge(actionSheet)} · {actionSheet.customer_name}
                </StitchText>
                <StitchText variant="h3" colorKey="onBackground" numberOfLines={1}>
                  {actionSheet.bag_title}
                </StitchText>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const it = actionSheet;
                    setActionSheet(null);
                    navigation.getParent()?.navigate('MerchantOrderDetail', {
                      orderId: it.id,
                    });
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <StitchIcon name="receipt_long" size={22} colorKey="primaryContainer" />
                  <StitchText variant="label" colorKey="onBackground">
                    View details
                  </StitchText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const it = actionSheet;
                    setActionSheet(null);
                    callCustomer(it);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <StitchIcon name="phone" size={22} colorKey="primaryContainer" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <StitchText variant="label" colorKey="onBackground">
                      Call customer
                    </StitchText>
                    {actionSheet && customerPhoneDisplay(actionSheet.customer_phone) ? (
                      <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1}>
                        {customerPhoneDisplay(actionSheet.customer_phone)}
                      </StitchText>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setActionSheet(null);
                    navigation.getParent()?.navigate('MerchantScanHandover');
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <StitchIcon name="qr_code_scanner" size={22} colorKey="primaryContainer" />
                  <StitchText variant="label" colorKey="onBackground">
                    Scan QR
                  </StitchText>
                </Pressable>

                {actionSheet.no_show_available ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const it = actionSheet;
                      setActionSheet(null);
                      Alert.alert('No-show', 'Report this pickup as no-show?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Continue',
                          style: 'destructive',
                          onPress: () => {
                            markNoShow(it.id).then((r) => {
                              if (r.error) Alert.alert('No-show', r.error);
                            });
                          },
                        },
                      ]);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <StitchIcon name="error" size={22} colorKey="error" />
                    <StitchText variant="label" colorKey="error">
                      Report no-show
                    </StitchText>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActionSheet(null)}
                  style={{ paddingVertical: spacing.md, alignItems: 'center' }}
                >
                  <StitchText variant="label" colorKey="textMuted">
                    Cancel
                  </StitchText>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={lateVerifyOrder != null}
        animationType="fade"
        onRequestClose={() => setLateVerifyOrder(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: `${colors.inverseSurface}66`,
            justifyContent: 'center',
            padding: spacing.lg,
          }}
          onPress={() => setLateVerifyOrder(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <StitchText variant="h3" colorKey="onBackground">
              Verify late pickup
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Enter the 6-character code from {lateVerifyOrder?.customer_name ?? 'the customer'}.
            </StitchText>
            <TextInput
              value={lateVerifyCode}
              onChangeText={(t) =>
                setLateVerifyCode(t.toUpperCase().replace(/\s/g, '').slice(0, 6))
              }
              placeholder="6-character code"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              maxLength={6}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.md,
                color: colors.onBackground,
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const order = lateVerifyOrder;
                if (!order) return;
                authorizeHandoverByCode(lateVerifyCode).then((r) => {
                  if (r.error) {
                    Alert.alert('Could not verify', r.error);
                    return;
                  }
                  setLateVerifyOrder(null);
                  setLateVerifyCode('');
                  Alert.alert('Handover complete', 'Order marked as collected.');
                });
              }}
              style={{
                minHeight: 48,
                borderRadius: radii.lg,
                backgroundColor: colors.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StitchText variant="label" colorKey="onPrimary">
                Authorize handover
              </StitchText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </StitchScreen>
  );
}
