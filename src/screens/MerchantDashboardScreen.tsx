import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  MerchantTabParamList,
  RootStackParamList,
} from '@/navigation/types';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantDashboard } from '@/hooks/useMerchantDashboard';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchCard,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';
import type { StitchIconName } from '@/ui/stitch/iconMap';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MerchantTabParamList, 'MerchantDashTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatOrderRef(id: string): string {
  const tail = id.replace(/-/g, '').slice(-6).toUpperCase();
  return `#ORD-${tail.slice(0, 4)}`;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
}

function merchantStatusChip(normalized: string): {
  label: string;
  bg: 'primaryHighlight' | 'accentHighlight';
  fg: 'primaryContainer' | 'accent';
} {
  if (normalized === 'collected') {
    return { label: 'Picked Up', bg: 'primaryHighlight', fg: 'primaryContainer' };
  }
  if (normalized === 'ready_for_pickup') {
    return { label: 'Pending', bg: 'accentHighlight', fg: 'accent' };
  }
  return { label: 'Pending', bg: 'accentHighlight', fg: 'accent' };
}

type StatDef = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof StitchIcon>['name'];
  value: string;
  sub?: string;
  subColorKey?: React.ComponentProps<typeof StitchText>['colorKey'];
  valueColorKey?: React.ComponentProps<typeof StitchText>['colorKey'];
  delta?: StatDelta;
};

type StatDelta = {
  /** `up` / `down` / `flat`. `flat` deltas suppress the chip entirely. */
  direction: 'up' | 'down' | 'flat';
  /** Pre-rendered chip text, e.g. `'+12%'`, `'-4%'`, or fallback `'+3 today'`. */
  label: string;
};

/**
 * Day-over-day delta builder for the dashboard KPI bento. Returns a chip
 * descriptor (or `undefined` when both today and yesterday are zero — no chip).
 *
 * Rules:
 *   - If `yesterday > 0`, compute `Math.round(((today - yesterday) / yesterday) * 100)`
 *     and emit `+N%` / `-N%` / `0%`.
 *   - If `yesterday === 0` and `today > 0`, emit `+N today` (a friendlier fallback
 *     than `+Infinity%`).
 *   - If both are zero, return `undefined`.
 *
 * Optionally rounds the today value (e.g. revenue currency) before percent math,
 * so a `4901 vs 4800` revenue compares cleanly as a 2% gain instead of fractional.
 */
function buildDelta(today: number, yesterday: number): StatDelta | undefined {
  const t = Number.isFinite(today) ? today : 0;
  const y = Number.isFinite(yesterday) ? yesterday : 0;
  if (t === 0 && y === 0) return undefined;
  if (y === 0) {
    return { direction: 'up', label: `+${t} today` };
  }
  const pct = Math.round(((t - y) / y) * 100);
  const direction: StatDelta['direction'] =
    pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const sign = pct > 0 ? '+' : '';
  return { direction, label: `${sign}${pct}%` };
}

export function MerchantDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { env } = useAuthContext();
  const { activeOutlet, merchant } = useMerchantContext(env);
  const { stats, recentOrders, loading, error, refetch } =
    useMerchantDashboard(env);
  const { colors, spacing, radii } = useStitchTheme();

  const venueLabel =
    String(activeOutlet?.name ?? merchant?.business_name ?? 'your outlet').trim() ||
    'your outlet';

  const statsDefs: StatDef[] = useMemo(
    () => [
      {
        key: 'bags',
        label: 'Active Bags',
        icon: 'shopping_bag',
        value: String(stats.active_bags),
        sub: 'Live listings',
        subColorKey: 'textMuted',
        valueColorKey: 'text',
        delta: buildDelta(stats.active_bags, stats.yesterday_active_bags),
      },
      {
        key: 'pickups',
        label: 'Pending pick-ups',
        icon: 'local_shipping',
        value: String(stats.pending_pickups_today),
        sub: 'Today, full count',
        subColorKey: 'textMuted',
        valueColorKey: 'accent',
        delta: buildDelta(
          stats.pending_pickups_today,
          stats.yesterday_pending_pickups,
        ),
      },
      {
        key: 'orders',
        label: 'Orders today',
        icon: 'receipt_long',
        value: String(stats.today_orders),
        sub: 'Active statuses',
        subColorKey: 'textMuted',
        valueColorKey: 'text',
        delta: buildDelta(stats.today_orders, stats.yesterday_orders),
      },
      {
        key: 'rev',
        label: 'Revenue (LKR)',
        icon: 'payments',
        value: stats.today_revenue.toFixed(0),
        sub: 'Paid + collected today',
        subColorKey: 'success',
        valueColorKey: 'primaryContainer',
        delta: buildDelta(
          Math.round(stats.today_revenue),
          Math.round(stats.yesterday_revenue),
        ),
      },
    ],
    [stats],
  );

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const tileBase: ViewStyle = {
      flex: 1,
      minWidth: 0,
    };
    const quickRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    };
    const outlineBtn: ViewStyle = {
      flex: 1,
      minHeight: 48,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primaryContainer,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    };
    const filledBtn: ViewStyle = {
      flex: 1,
      minHeight: 48,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.primaryContainer,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    };
    const gridRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.md,
    };
    const orderRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    const avatar: ViewStyle = {
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const chip: ViewStyle = {
      marginTop: 4,
      alignSelf: 'flex-end',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    };
    const linkPress: ViewStyle = { paddingVertical: spacing.sm };
    const err: TextStyle = { color: colors.error };
    return {
      pagePad,
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      quickRow,
      outlineBtn,
      filledBtn,
      gridRow,
      tileBase,
      orderRow,
      avatar,
      chip,
      linkPress,
      err,
    };
  }, [colors, radii, spacing]);

  const parentNav = navigation.getParent();

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : null}
      {error ? (
        <StitchText variant="body-md" style={styles.err}>
          {error}
        </StitchText>
      ) : null}

      <View>
        <StitchText variant="h1" colorKey="text">
          {"Today's Summary"}
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          {`Here's what's happening at ${venueLabel} today.`}
        </StitchText>
        <View style={styles.quickRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.outlineBtn,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            onPress={() =>
              navigation.navigate('MerchantOrdersTab', { view: 'verification' })
            }
          >
            <StitchIcon name="qr_code_scanner" size={20} colorKey="primaryContainer" />
            <StitchText variant="label" colorKey="primaryContainer">
              Verify code
            </StitchText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.filledBtn,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            onPress={() => parentNav?.navigate('MerchantBagCreate')}
          >
            <StitchIcon name="add" size={20} colorKey="onPrimary" />
            <StitchText variant="label" colorKey="onPrimary">
              Create new bag
            </StitchText>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={styles.gridRow}>
          <StitchSurface elevated padding="none" style={[styles.tileBase, { flex: 1 }]}>
            <StatTile def={statsDefs[0]!} />
          </StitchSurface>
          <StitchSurface elevated padding="none" style={[styles.tileBase, { flex: 1 }]}>
            <StatTile def={statsDefs[1]!} />
          </StitchSurface>
        </View>
        <View style={styles.gridRow}>
          <StitchSurface elevated padding="none" style={[styles.tileBase, { flex: 1 }]}>
            <StatTile def={statsDefs[2]!} />
          </StitchSurface>
          <StitchSurface elevated padding="none" style={[styles.tileBase, { flex: 1 }]}>
            <StatTile def={statsDefs[3]!} />
          </StitchSurface>
        </View>
      </View>

      <StitchCard padding="none">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          }}
        >
          <StitchText variant="h3" colorKey="text">
            Recent orders
          </StitchText>
          <Pressable onPress={() => navigation.navigate('MerchantOrdersTab')}>
            <StitchText variant="label" colorKey="primaryContainer">
              View all
            </StitchText>
          </Pressable>
        </View>
        {recentOrders.length === 0 ? (
          <View style={{ padding: spacing.md }}>
            <StitchText variant="body-sm" colorKey="textMuted">
              No orders yet.
            </StitchText>
          </View>
        ) : (
          recentOrders.map((r, index) => {
            const chipSpec = merchantStatusChip(r.status);
            const initials = customerInitials(r.customer_name);
            const highlight = index === 0;
            return (
              <Pressable
                key={r.id}
                style={[
                  styles.orderRow,
                  index === recentOrders.length - 1 ? { borderBottomWidth: 0 } : null,
                ]}
                onPress={() =>
                  parentNav?.navigate('MerchantOrderDetail', { orderId: r.id })
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: highlight
                          ? colors.primaryHighlight
                          : colors.surfaceContainer,
                      },
                    ]}
                  >
                    <StitchText
                      variant="h3"
                      colorKey={highlight ? 'primaryContainer' : 'textMuted'}
                    >
                      {initials}
                    </StitchText>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <StitchText variant="label" colorKey="text" numberOfLines={1}>
                      {formatOrderRef(r.id)}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
                      {r.customer_name} · {r.bag_title}
                    </StitchText>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8, flexShrink: 0 }}>
                  <StitchText variant="label" colorKey="text">
                    {r.total != null ? `Rs. ${Number(r.total).toFixed(0)}` : '—'}
                  </StitchText>
                  <View style={[styles.chip, { backgroundColor: colors[chipSpec.bg] }]}>
                    <StitchText variant="label-caps" colorKey={chipSpec.fg}>
                      {chipSpec.label}
                    </StitchText>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </StitchCard>

      <StitchCard padding="none">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          }}
        >
          <StitchText variant="h3" colorKey="text">
            Popular bags
          </StitchText>
        </View>
        <View style={{ padding: spacing.md }}>
          <StitchText variant="body-sm" colorKey="textMuted">
            Bag thumbnails and live popularity metrics are not on the dashboard API yet;
            use inventory to curate listings.
          </StitchText>
        </View>
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => parentNav?.navigate('MerchantBagsList')}
            style={({ pressed }) => ({
              width: '100%',
              paddingVertical: spacing.sm,
              borderRadius: radii.lg,
              backgroundColor: colors.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <StitchText variant="label" colorKey="primaryContainer">
              Manage inventory
            </StitchText>
            <StitchIcon name="arrow_forward" size={18} colorKey="primaryContainer" />
          </Pressable>
        </View>
      </StitchCard>

      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
          }}
        >
          <StitchText variant="h3" colorKey="text">
            Quick actions
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted">
            Tap to jump in
          </StitchText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          {(
            [
              {
                key: 'orders',
                label: 'All orders',
                icon: 'receipt_long',
                onPress: () => navigation.navigate('MerchantOrdersTab'),
              },
              {
                key: 'late',
                label: 'Late pickups',
                icon: 'schedule',
                onPress: () =>
                  navigation.navigate('MerchantOrdersTab', { view: 'late-pickups' }),
              },
              {
                key: 'analytics',
                label: 'Analytics',
                icon: 'analytics',
                onPress: () => parentNav?.navigate('MerchantAnalytics'),
              },
              {
                key: 'finance',
                label: 'Finance',
                icon: 'attach_money',
                onPress: () => parentNav?.navigate('MerchantFinance'),
              },
              {
                key: 'payouts',
                label: 'Payouts',
                icon: 'account_balance_wallet',
                onPress: () => parentNav?.navigate('MerchantPayouts'),
              },
              {
                key: 'monitor',
                label: 'Live monitor',
                icon: 'monitoring',
                onPress: () => parentNav?.navigate('MerchantLiveMonitor'),
              },
              {
                key: 'onboard',
                label: 'Onboarding',
                icon: 'corporate_fare',
                onPress: () => parentNav?.navigate('MerchantOnboarding'),
              },
              {
                key: 'profile',
                label: 'Business profile',
                icon: 'storefront',
                onPress: () => parentNav?.navigate('MerchantProfile'),
              },
            ] as const
          ).map((tile) => (
            <Pressable
              key={tile.key}
              accessibilityRole="button"
              onPress={tile.onPress}
              style={({ pressed }) => ({
                flexBasis: '47%',
                flexGrow: 1,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                backgroundColor: pressed ? colors.surface2 : colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.default,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primaryHighlight,
                }}
              >
                <StitchIcon
                  name={tile.icon as StitchIconName}
                  size={20}
                  colorKey="primaryContainer"
                />
              </View>
              <StitchText variant="label" colorKey="text">
                {tile.label}
              </StitchText>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={() => void refetch()} style={styles.linkPress}>
        <StitchText variant="label" colorKey="primaryContainer">
          Refresh dashboard
        </StitchText>
      </Pressable>
    </StitchScreen>
  );
}

function StatTile({ def }: { def: StatDef }): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const chipVisible = def.delta && def.delta.direction !== 'flat';
  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'nowrap',
        }}
      >
        <StitchIcon name={def.icon} size={20} colorKey="textMuted" />
        <StitchText
          variant="label-caps"
          colorKey="textMuted"
          style={{ flex: 1, flexShrink: 1, minWidth: 0 }}
          numberOfLines={2}
        >
          {def.label}
        </StitchText>
      </View>
      {chipVisible && def.delta ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'flex-end' }}
          accessibilityLabel={`${def.delta.label} versus yesterday`}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: radii.full,
              backgroundColor: colors.surfaceContainerLowest,
            }}
          >
            <StitchIcon
              name={def.delta.direction === 'up' ? 'trending_up' : 'trending_down'}
              size={14}
              colorKey={def.delta.direction === 'up' ? 'success' : 'error'}
            />
            <StitchText
              variant="body-sm"
              colorKey={def.delta.direction === 'up' ? 'success' : 'error'}
            >
              {def.delta.label}
            </StitchText>
          </View>
        </View>
      ) : null}
      <StitchText variant="display" colorKey={def.valueColorKey ?? 'text'}>
        {def.value}
      </StitchText>
      {def.sub ? (
        <StitchText variant="body-sm" colorKey={def.subColorKey ?? 'textMuted'}>
          {def.sub}
        </StitchText>
      ) : null}
    </View>
  );
}

