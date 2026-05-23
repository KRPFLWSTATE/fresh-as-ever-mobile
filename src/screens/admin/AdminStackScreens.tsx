/**
 * Admin stack screens — Stitch parity (`stitch_fresh_as_ever_food_rescue-2` admin_* folders).
 * Data uses Supabase anon client; requires RLS allowing `profiles.role = admin` where applicable.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Switch,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { AdminStackParamList } from '@/navigation/types';
import {
  navigateToAdminComplaints,
  navigateToAdminHome,
  navigateToAdminMerchants,
  navigateToAdminPlatformConfig,
  navigateToAdminPlatformOrders,
  type AdminCrossTabNavigation,
} from '@/navigation/adminNavigation';
import { adminCollectOrder } from '@/lib/adminCollectOrder';
import { isOpenComplaintStatus } from '@/lib/adminComplaints';
import {
  useAdminDashboardMetrics,
  type AdminDashboardRevenueBucket,
} from '@/hooks/useAdminDashboardMetrics';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { fetchLocationSearch } from '@/lib/locationApi';
import { getSupabase } from '@/lib/supabase';
import { postOrderRefund } from '@/lib/refundApi';
import { useScrollContentBottomPad } from '@/lib/useScrollContentBottomPad';
import { useAuthContext } from '@/context/AuthContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type AdminNav = NativeStackNavigationProp<AdminStackParamList>;

function useAdminGate(): boolean {
  const { resolvedRole } = useAuthContext();
  return resolvedRole === 'admin';
}

function PolicyHint({ message }: { message: string }): React.ReactElement {
  const { colors } = useStitchTheme();
  return (
    <StitchText variant="body-sm" colorKey="textMuted" style={{ color: colors.error }}>
      {message}
    </StitchText>
  );
}

function AdminOnlyNotice(): React.ReactElement {
  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: 16 } }}>
      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">
          Admin only
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 8 }}>
          Sign in with an admin account to access this screen.
        </StitchText>
      </StitchSurface>
    </StitchScreen>
  );
}

function AdminSignOutFooter(): React.ReactElement {
  const { signOut } = useAuthContext();
  const { spacing } = useStitchTheme();
  return (
    <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        onPress={() => {
          void signOut();
        }}
        style={({ pressed }) => ({
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <StitchText variant="label" colorKey="textMuted">
          Log out
        </StitchText>
      </Pressable>
    </View>
  );
}

export function AdminHomeScreen() {
  const navigation = useNavigation<AdminNav>();
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminHome'>>();
  const { env } = useAuthContext();
  const { colors, radii, spacing } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const {
    ordersCount,
    profilesCount,
    todaysOrders,
    openComplaints,
    pendingMerchants,
    pendingSettlements,
    newMerchantsWeek,
    recentEvents,
    trend,
    revenueTrend,
    trendUsesDemoSeed,
    reload,
  } = useAdminDashboardMetrics(env);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);

  useEffect(() => {
    if (ok) void reload();
  }, [ok, reload]);

  const menu = useMemo(
    () =>
      [
        { title: 'Settlements', screen: 'AdminSettlements' as const, crossTab: false },
        { title: 'Platform orders', screen: 'AdminPlatformOrders' as const, crossTab: 'orders' as const },
        { title: 'Configuration', screen: 'AdminPlatformConfig' as const, crossTab: 'config' as const },
        { title: 'Complaints', screen: 'AdminComplaints' as const, crossTab: 'complaints' as const },
        { title: 'Audit logs', screen: 'AdminAuditLogs' as const, crossTab: false },
        { title: 'Platform settings', screen: 'AdminSystemSettings' as const, crossTab: false },
        { title: 'Merchants', screen: 'AdminMerchants' as const, crossTab: 'merchants' as const },
        { title: 'Application review', screen: 'AdminApplicationReview' as const, crossTab: false },
        { title: 'Promos', screen: 'AdminPromosAdmin' as const, crossTab: false },
      ] as const,
    [],
  );

  const openMenuItem = useCallback(
    (item: (typeof menu)[number]) => {
      const nav = navigation as unknown as AdminCrossTabNavigation;
      if (item.crossTab === 'orders') {
        navigateToAdminPlatformOrders(nav);
        return;
      }
      if (item.crossTab === 'config') {
        navigateToAdminPlatformConfig(nav);
        return;
      }
      if (item.crossTab === 'complaints') {
        navigateToAdminComplaints(nav);
        return;
      }
      if (item.crossTab === 'merchants') {
        navigateToAdminMerchants(nav);
        return;
      }
      navigation.navigate(item.screen);
    },
    [navigation],
  );

  const styles = useMemo(() => {
    const topRow: ViewStyle = {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    };
    const kpiRow: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md };
    const kpiCard: ViewStyle = {
      flex: 1,
      minWidth: 140,
      borderRadius: radii.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const menuRow: ViewStyle = {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    };
    return {
      content: {
        paddingHorizontal: spacing.pageMarginMobile,
        paddingTop: spacing.md,
        paddingBottom: scrollBottomPad,
        gap: spacing.lg,
      },
      topRow,
      quickHeader: { marginBottom: spacing.sm },
      kpiRow,
      kpiCard,
      menuCard: {
        borderWidth: 1,
        borderColor: colors.divider,
      },
      menuRow,
    };
  }, [colors, radii, spacing, scrollBottomPad]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen
      scroll
      scrollProps={{ contentContainerStyle: styles.content }}
    >
      <View style={styles.topRow}>
        <View>
          <StitchText variant="h1" colorKey="text">
            Platform overview
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Colombo region pulse
          </StitchText>
        </View>
        <StitchButton
          title="Export report"
          variant="secondary"
          onPress={() => {
            setExportCopied(false);
            setExportOpen(true);
          }}
        />
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">Today's orders</StitchText>
          <StitchText variant="display" colorKey="text" style={{ marginTop: 6 }}>
            {todaysOrders == null ? '—' : String(todaysOrders)}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
            {ordersCount == null ? '—' : `${ordersCount.toLocaleString()} all-time`}
          </StitchText>
        </View>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">Profiles</StitchText>
          <StitchText variant="display" colorKey="text" style={{ marginTop: 6 }}>
            {profilesCount == null ? '—' : profilesCount.toLocaleString()}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
            Customers + merchants
          </StitchText>
        </View>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">Open complaints</StitchText>
          <StitchText variant="display" colorKey={(openComplaints ?? 0) > 0 ? 'error' : 'text'} style={{ marginTop: 6 }}>
            {openComplaints == null ? '—' : String(openComplaints)}
          </StitchText>
          <Pressable onPress={() => navigateToAdminComplaints(navigation as unknown as AdminCrossTabNavigation)}>
            <StitchText variant="label-caps" colorKey="primaryContainer" style={{ marginTop: 2 }}>
              Review
            </StitchText>
          </Pressable>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">Merchant queue</StitchText>
          <StitchText variant="display" colorKey={(pendingMerchants ?? 0) > 0 ? 'accent' : 'text'} style={{ marginTop: 6 }}>
            {pendingMerchants == null ? '—' : String(pendingMerchants)}
          </StitchText>
          <Pressable onPress={() => navigation.navigate('AdminApplicationReview')}>
            <StitchText variant="label-caps" colorKey="primaryContainer" style={{ marginTop: 2 }}>
              Review applications
            </StitchText>
          </Pressable>
        </View>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">Pending payouts</StitchText>
          <StitchText variant="display" colorKey="text" style={{ marginTop: 6 }}>
            {pendingSettlements == null ? '—' : String(pendingSettlements)}
          </StitchText>
          <Pressable onPress={() => navigation.navigate('AdminSettlements')}>
            <StitchText variant="label-caps" colorKey="primaryContainer" style={{ marginTop: 2 }}>
              Open settlements
            </StitchText>
          </Pressable>
        </View>
      </View>

      <View>
        <View style={styles.topRow}>
          <StitchText variant="h3" colorKey="text">Orders this week</StitchText>
          <StitchText variant="label-caps" colorKey="textMuted">
            Last 7 days
          </StitchText>
        </View>
        <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider, marginTop: spacing.sm }}>
          {trend == null ? (
            <ActivityIndicator color={colors.primaryContainer} />
          ) : (
            (() => {
              const max = Math.max(1, ...trend.map((b) => b.count));
              return (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', minHeight: 96 }}>
                  {trend.map((b, idx) => {
                    const heightPct = (b.count / max) * 80; // 0..80% so labels have room
                    const isToday = idx === trend.length - 1;
                    const yyyy = b.date.getFullYear();
                    const mm = String(b.date.getMonth() + 1).padStart(2, '0');
                    const dd = String(b.date.getDate()).padStart(2, '0');
                    const dayKey = `${yyyy}-${mm}-${dd}`;
                    return (
                      <Pressable
                        key={`${b.label}-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${b.label} ${dayKey}: ${b.count} orders, tap to filter`}
                        onPress={() =>
                          navigateToAdminPlatformOrders(navigation as unknown as AdminCrossTabNavigation, {
                            day: dayKey,
                          })
                        }
                        style={{ flex: 1, alignItems: 'center' }}
                      >
                        <View
                          style={{
                            height: 80,
                            width: '100%',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <View
                            style={{
                              height: Math.max(4, heightPct),
                              width: '70%',
                              alignSelf: 'center',
                              borderRadius: 4,
                              backgroundColor: isToday ? colors.primary : colors.primaryHighlight,
                            }}
                          />
                        </View>
                        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                          {b.label}
                        </StitchText>
                        <StitchText variant="label" colorKey={isToday ? 'primaryContainer' : 'text'}>
                          {b.count}
                        </StitchText>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()
          )}
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            Tap a bar to filter Platform orders to that day.
            {trendUsesDemoSeed
              ? ' Demo mode: showing seeded 7-day orders because live data was empty.'
              : ''}
          </StitchText>
        </StitchSurface>
      </View>

      <View>
        <View style={styles.topRow}>
          <StitchText variant="h3" colorKey="text">Revenue this week</StitchText>
          <StitchText variant="label-caps" colorKey="textMuted">
            Settled GMV
          </StitchText>
        </View>
        <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider, marginTop: spacing.sm }}>
          {revenueTrend == null ? (
            <ActivityIndicator color={colors.primaryContainer} />
          ) : (
            (() => {
              const max = Math.max(1, ...revenueTrend.map((b) => b.amount));
              const totalLkr = revenueTrend.reduce((sum, b) => sum + b.amount, 0);
              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm }}>
                    <StitchText variant="display" colorKey="text">
                      Rs. {Math.round(totalLkr).toLocaleString()}
                    </StitchText>
                    <StitchText variant="label-caps" colorKey="textMuted">
                      7-day GMV
                    </StitchText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', minHeight: 96 }}>
                    {revenueTrend.map((b, idx) => {
                      const heightPct = (b.amount / max) * 80;
                      const isToday = idx === revenueTrend.length - 1;
                      return (
                        <Pressable
                          key={`rev-${b.label}-${idx}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${b.label}: Rs. ${Math.round(b.amount).toLocaleString()} settled, open settlements`}
                          onPress={() => navigation.navigate('AdminSettlements')}
                          style={{ flex: 1, alignItems: 'center' }}
                        >
                          <View
                            style={{
                              height: 80,
                              width: '100%',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <View
                              style={{
                                height: Math.max(4, heightPct),
                                width: '70%',
                                alignSelf: 'center',
                                borderRadius: 4,
                                backgroundColor: isToday ? colors.accent : colors.accentHighlight,
                              }}
                            />
                          </View>
                          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                            {b.label}
                          </StitchText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              );
            })()
          )}
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            Tap to open Settlements. Sum of totals where order_status ∈ (collected, completed).
          </StitchText>
        </StitchSurface>
      </View>

      <View>
        <View style={styles.topRow}>
          <StitchText variant="h3" colorKey="text">Recent activity</StitchText>
          <Pressable onPress={() => navigation.navigate('AdminAuditLogs')}>
            <StitchText variant="label-caps" colorKey="primaryContainer">View all</StitchText>
          </Pressable>
        </View>
        <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider, marginTop: spacing.sm }}>
          {recentEvents.length === 0 ? (
            <StitchText variant="body-sm" colorKey="textMuted">
              No recent audit events. Activity will appear here as admins and triggers fire.
            </StitchText>
          ) : (
            recentEvents.map((ev, idx) => (
              <View
                key={ev.id}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: idx === recentEvents.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <StitchText variant="label" colorKey="text">{ev.title}</StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {ev.at ? new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </StitchText>
                </View>
                <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
                  {ev.detail}
                </StitchText>
                {ev.kind || ev.action ? (
                  <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: 2 }}>
                    {[ev.kind, ev.action].filter(Boolean).join(' · ')}
                  </StitchText>
                ) : null}
              </View>
            ))
          )}
        </StitchSurface>
      </View>

      <PolicyHint message="If counts fail, verify Supabase RLS allows admin reads." />

      <View style={styles.quickHeader}>
        <StitchText variant="h3" colorKey="text">
          Admin tools
        </StitchText>
      </View>
      <StitchSurface elevated padding="none" style={styles.menuCard}>
        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate('AdminHome', { colombo: true })}
        >
          <StitchText variant="label" colorKey="text">
            Colombo ops view{route.params?.colombo ? ' · active' : ''}
          </StitchText>
          <StitchIcon name="chevron_right" size={20} colorKey="textMuted" />
        </Pressable>
        {menu.map((m, idx) => (
          <Pressable
            key={m.screen}
            style={[
              styles.menuRow,
              idx === menu.length - 1 && { borderBottomWidth: 0 },
            ]}
            onPress={() => openMenuItem(m)}
          >
            <StitchText variant="label" colorKey="text">{m.title}</StitchText>
            <StitchIcon name="chevron_right" size={20} colorKey="textMuted" />
          </Pressable>
        ))}
      </StitchSurface>

      <AdminExportReportModal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        copied={exportCopied}
        onCopied={() => setExportCopied(true)}
        rows={buildExportRows({
          todaysOrders,
          ordersCount,
          revenueTrend,
          newMerchantsWeek,
          openComplaints,
          pendingMerchants,
          pendingSettlements,
        })}
      />

      <AdminSignOutFooter />
    </StitchScreen>
  );
}

type AdminExportRow = { label: string; value: string };

function buildExportRows(input: {
  todaysOrders: number | null;
  ordersCount: number | null;
  revenueTrend: AdminDashboardRevenueBucket[] | null;
  newMerchantsWeek: number | null;
  openComplaints: number | null;
  pendingMerchants: number | null;
  pendingSettlements: number | null;
}): AdminExportRow[] {
  const totalRevenue = (input.revenueTrend ?? []).reduce(
    (sum, b) => sum + (Number.isFinite(b.amount) ? b.amount : 0),
    0,
  );
  const fmtNum = (n: number | null) => (n == null ? '—' : String(n));
  return [
    { label: 'Date', value: new Date().toISOString().slice(0, 10) },
    { label: 'Orders (today)', value: fmtNum(input.todaysOrders) },
    { label: 'Orders (all-time)', value: fmtNum(input.ordersCount) },
    {
      label: 'Revenue (last 7 days, LKR)',
      value: `Rs. ${Math.round(totalRevenue).toLocaleString()}`,
    },
    { label: 'New merchants (7d)', value: fmtNum(input.newMerchantsWeek) },
    { label: 'Open complaints', value: fmtNum(input.openComplaints) },
    { label: 'Pending merchant applications', value: fmtNum(input.pendingMerchants) },
    { label: 'Pending settlements', value: fmtNum(input.pendingSettlements) },
  ];
}

function rowsToCsv(rows: AdminExportRow[]): string {
  const escape = (s: string) => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = 'metric,value';
  const body = rows.map((r) => `${escape(r.label)},${escape(r.value)}`).join('\n');
  return `${header}\n${body}\n`;
}

function AdminExportReportModal({
  visible,
  onClose,
  rows,
  copied,
  onCopied,
}: {
  visible: boolean;
  onClose: () => void;
  rows: AdminExportRow[];
  copied: boolean;
  onCopied: () => void;
}): React.ReactElement {
  const { colors, radii, spacing } = useStitchTheme();
  const csv = useMemo(() => rowsToCsv(rows), [rows]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: `${colors.inverseSurface}99`,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.md,
            maxHeight: '85%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <StitchText variant="h2" colorKey="text">
                Export report
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
                Last 7 days snapshot · CSV payload below
              </StitchText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close export report"
              onPress={onClose}
              style={{ padding: 6 }}
            >
              <StitchIcon name="close" size={22} colorKey="textMuted" />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                overflow: 'hidden',
              }}
            >
              {rows.map((r, idx) => (
                <View
                  key={r.label}
                  style={{
                    flexDirection: 'row',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                    backgroundColor: idx % 2 === 0 ? colors.surface : colors.surfaceContainerLow,
                  }}
                >
                  <StitchText
                    variant="label-caps"
                    colorKey="textMuted"
                    style={{ flex: 1, minWidth: 0 }}
                    numberOfLines={2}
                  >
                    {r.label}
                  </StitchText>
                  <StitchText variant="label" colorKey="text" style={{ flex: 1, textAlign: 'right' }}>
                    {r.value}
                  </StitchText>
                </View>
              ))}
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            <StitchButton
              title="Share CSV"
              variant="primary"
              onPress={() => {
                Share.share({
                  title: 'Fresh As Ever — Platform report',
                  message: csv,
                }).catch(() => {});
              }}
              style={{ flex: 1, minWidth: 140 }}
            />
            <StitchButton
              title={copied ? 'Copied!' : 'Copy to clipboard'}
              variant="secondary"
              onPress={() => {
                try {
                  Clipboard.setString(csv);
                  onCopied();
                } catch {
                  // Clipboard module is autolinked but degrade gracefully if it fails.
                }
              }}
              style={{ flex: 1, minWidth: 140 }}
            />
          </View>
          <StitchText variant="body-sm" colorKey="textMuted">
            Use the share intent to drop the CSV into Mail, Slack, or Drive. Tap **Copy** if your
            target app doesn&apos;t accept the share intent.
          </StitchText>
        </View>
      </View>
    </Modal>
  );
}

export function AdminSettlementsScreen() {
  const route =
    useRoute<RouteProp<AdminStackParamList, 'AdminSettlements'>>();
  const navigation = useNavigation<AdminNav>();
  const { env } = useAuthContext();
  const { colors, radii, spacing } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const seg = route.params?.segmentIndex ?? 1;
  const ok = useAdminGate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<
    {
      id: string;
      merchant_name: string;
      created_at: string | null;
      net_payout: number;
      status: string;
    }[]
  >([]);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('settlements')
        .select(
          'id, created_at, net_payout, status, merchant:merchants(business_name)',
        )
        .order('created_at', { ascending: false })
        .limit(80);

      if (!m) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setErr(null);
        const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          net_payout: Number(r.net_payout ?? 0),
          status: String(r.status ?? 'unknown'),
          merchant_name:
            String(
              (r.merchant as Record<string, unknown> | undefined)?.business_name ?? '',
            ) || 'Merchant',
        }));
        setRows(mapped);
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok]);

  const segments = [1, 2, 3, 4, 5] as const;

  const filteredRows = useMemo(() => {
    const s = (v: unknown) => String(v ?? '').trim().toLowerCase();
    if (seg === 1) return rows;
    if (seg === 2) return rows.filter((r) => ['pending', 'queued'].includes(s(r.status)));
    if (seg === 3) return rows.filter((r) => ['processed', 'processing'].includes(s(r.status)));
    if (seg === 4) return rows.filter((r) => ['paid', 'completed'].includes(s(r.status)));
    if (seg === 5) return rows.filter((r) => ['failed', 'issue', 'blocked'].includes(s(r.status)));
    return rows;
  }, [rows, seg]);

  const totals = useMemo(() => {
    const amount = filteredRows.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0);
    return { amount, count: filteredRows.length };
  }, [filteredRows]);

  const nextPayoutRun = useMemo(() => {
    const pending = rows.filter((r) => {
      const s = r.status.trim().toLowerCase();
      return s === 'pending' || s === 'queued' || s === 'processing';
    });
    if (pending.length === 0) return null;
    const earliest = pending
      .map((r) => (r.created_at ? new Date(r.created_at).getTime() : NaN))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    return {
      date: earliest ? new Date(earliest) : null,
      count: pending.length,
      amount: pending.reduce((sum, r) => sum + Number(r.net_payout ?? 0), 0),
    };
  }, [rows]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Settlements</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Segment {seg} · Recent merchant settlements.
      </StitchText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {segments.map((s) => (
          <Pressable
            key={s}
            onPress={() => navigation.setParams({ segmentIndex: s })}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              borderRadius: radii.full,
              backgroundColor: s === seg ? colors.surfaceContainerHighest : colors.surface,
              borderWidth: 1,
              borderColor: colors.divider,
            }}
          >
            <StitchText variant="label" colorKey={s === seg ? 'text' : 'textMuted'}>
              Segment {s}
            </StitchText>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />
      ) : err ? (
        <PolicyHint message={err} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            <StitchSurface elevated padding="md" style={{ flex: 1, minWidth: 200 }}>
              <StitchText variant="h3" colorKey="text">Recent transactions</StitchText>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <StitchText variant="label-caps" colorKey="textMuted">Amount</StitchText>
                  <StitchText variant="h2" colorKey="text">
                    Rs. {Math.round(totals.amount).toLocaleString()}
                  </StitchText>
                </View>
                <View style={{ flex: 1 }}>
                  <StitchText variant="label-caps" colorKey="textMuted">Batches</StitchText>
                  <StitchText variant="h2" colorKey="text">{totals.count}</StitchText>
                </View>
              </View>
            </StitchSurface>

            <StitchSurface
              elevated
              padding="md"
              style={{ flex: 1, minWidth: 200, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <StitchIcon name="account_balance" size={24} colorKey="textMuted" />
              </View>
              <StitchText variant="label" colorKey="text">Next payout run</StitchText>
              <StitchText
                variant="h2"
                colorKey="primaryContainer"
                style={{ marginTop: 4, textAlign: 'center' }}
              >
                {nextPayoutRun?.date
                  ? nextPayoutRun.date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  : 'No pending'}
              </StitchText>
              {nextPayoutRun ? (
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4, textAlign: 'center' }}>
                  {nextPayoutRun.count} pending · Rs. {Math.round(nextPayoutRun.amount).toLocaleString()}
                </StitchText>
              ) : (
                <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4, textAlign: 'center' }}>
                  All settlements processed.
                </StitchText>
              )}
            </StitchSurface>
          </View>

          <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingBottom: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
              }}
            >
              <StitchText variant="label-caps" colorKey="textMuted" style={{ flex: 1 }}>
                Merchant
              </StitchText>
              <StitchText variant="label-caps" colorKey="textMuted" style={{ width: 110 }}>
                Date
              </StitchText>
              <StitchText variant="label-caps" colorKey="textMuted" style={{ width: 110, textAlign: 'right' }}>
                Amount
              </StitchText>
              <StitchText variant="label-caps" colorKey="textMuted" style={{ width: 110, textAlign: 'right' }}>
                Status
              </StitchText>
            </View>

            {filteredRows.length === 0 ? (
              <StitchText variant="body-sm" colorKey="textMuted" style={{ paddingTop: spacing.md }}>
                No settlements found for this segment (or blocked by RLS).
              </StitchText>
            ) : (
              filteredRows.map((r, idx) => {
                const status = String(r.status ?? 'unknown');
                const pill = statusPillTokens(status, colors);
                const initial = (r.merchant_name.trim()[0] ?? 'M').toUpperCase();
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => navigation.navigate('AdminSettlementDetail', { settlementId: r.id })}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                      borderBottomWidth: idx === filteredRows.length - 1 ? 0 : 1,
                      borderBottomColor: colors.divider,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: radii.default,
                          backgroundColor: colors.primaryHighlight,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <StitchText variant="label" colorKey="primary">{initial}</StitchText>
                      </View>
                      <StitchText
                        variant="label"
                        colorKey="text"
                        numberOfLines={2}
                        style={{ flex: 1, flexShrink: 1, minWidth: 0 }}
                      >
                        {r.merchant_name}
                      </StitchText>
                    </View>
                    <StitchText variant="body-sm" colorKey="textMuted" style={{ width: 110 }}>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric',
                          })
                        : '—'}
                    </StitchText>
                    <StitchText variant="label" colorKey="text" style={{ width: 110, textAlign: 'right' }}>
                      Rs. {Math.round(r.net_payout).toLocaleString()}
                    </StitchText>
                    <View style={{ width: 110, alignItems: 'flex-end', flexShrink: 0 }}>
                      <View
                        style={{
                          backgroundColor: pill.bg,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: radii.full,
                        }}
                      >
                        <StitchText variant="body-sm" colorKey="text" style={{ color: pill.fg }}>
                          {status}
                        </StitchText>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </StitchSurface>
        </>
      )}
    </StitchScreen>
  );
}

type AdminOrderRow = {
  id: string;
  order_status: string | null;
  total: number | null;
  customer_name: string;
  merchant_name: string;
  created_at: string | null;
};

const ADMIN_ORDERS_PAGE_SIZE = 20;

export type AdminOrdersSortKey =
  | 'createdAt:desc'
  | 'createdAt:asc'
  | 'total:desc'
  | 'total:asc';

function OrdersList({
  query,
  statusFilter,
  day,
  page,
  sortKey = 'createdAt:desc',
  onStats,
  onCountChange,
}: {
  query: string;
  statusFilter: 'all' | 'reserved' | 'collected' | 'cancelled';
  /** YYYY-MM-DD local day filter or null for all dates. */
  day: string | null;
  page: number;
  sortKey?: AdminOrdersSortKey;
  onStats?: (stats: { total: number; pending: number; gross: number }) => void;
  onCountChange?: (total: number) => void;
}) {
  const navigation = useNavigation<AdminNav>();
  const { env } = useAuthContext();
  const { colors, spacing, radii } = useStitchTheme();
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const trimmed = query.trim();
      const from = (page - 1) * ADMIN_ORDERS_PAGE_SIZE;
      const to = from + ADMIN_ORDERS_PAGE_SIZE - 1;

      const [sortCol, sortDir] = sortKey.split(':') as [
        'createdAt' | 'total',
        'asc' | 'desc',
      ];
      const sortDbCol = sortCol === 'createdAt' ? 'created_at' : 'total';
      let req = sb
        .from('orders')
        .select(
          `
          id,
          order_status,
          total,
          created_at,
          customer:profiles(full_name),
          outlet:outlets(name)
        `,
          { count: 'exact' },
        )
        .order(sortDbCol, { ascending: sortDir === 'asc' })
        .range(from, to);

      if (statusFilter !== 'all') {
        const map: Record<string, string[]> = {
          reserved: ['reserved', 'ready_for_pickup', 'paid'],
          collected: ['collected', 'completed'],
          cancelled: ['cancelled'],
        };
        const statuses = map[statusFilter];
        if (statuses) req = req.in('order_status', statuses);
      }

      if (trimmed) {
        const escaped = trimmed.replace(/[%,]/g, '');
        req = req.or(`reservation_code.ilike.%${escaped}%,id.ilike.%${escaped}%`);
      }

      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const start = new Date(`${day}T00:00:00`);
        if (!Number.isNaN(start.getTime())) {
          const end = new Date(start);
          end.setDate(start.getDate() + 1);
          req = req
            .gte('created_at', start.toISOString())
            .lt('created_at', end.toISOString());
        }
      }

      const { data, error, count } = await req;
      if (!m) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setErr(null);
        const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          order_status: typeof r.order_status === 'string' ? r.order_status : null,
          total: typeof r.total === 'number' ? r.total : Number(r.total ?? 0),
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          customer_name:
            String((r.customer as Record<string, unknown> | undefined)?.full_name ?? '') ||
            'Customer',
          merchant_name:
            String((r.outlet as Record<string, unknown> | undefined)?.name ?? '') ||
            'Merchant',
        }));
        setRows(mapped);
        if (typeof count === 'number') {
          onCountChange?.(count);
        }
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, page, query, statusFilter, day, sortKey, onCountChange, reloadKey]);

  useEffect(() => {
    if (!onStats) return;
    const pending = rows.filter((r) =>
      ['reserved', 'ready_for_pickup', 'paid'].includes(
        String(r.order_status ?? '').toLowerCase(),
      ),
    ).length;
    const gross = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    onStats({ total: rows.length, pending, gross });
  }, [onStats, rows]);

  const updateOrderStatus = useCallback(
    async (orderId: string, nextStatus: 'cancelled' | 'collected') => {
      setBusyId(orderId);
      if (nextStatus === 'collected') {
        const result = await adminCollectOrder(env, orderId);
        setBusyId(null);
        if (!result.ok) {
          Alert.alert('Update failed', result.message);
          return;
        }
        setReloadKey((k) => k + 1);
        return;
      }
      const sb = getSupabase(env);
      const patch: Record<string, unknown> = {
        order_status: 'cancelled',
        updated_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        cancellation_reason: 'Admin override',
      };
      const { error } = await sb.from('orders').update(patch).eq('id', orderId);
      setBusyId(null);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [env],
  );

  const openRowActions = useCallback(
    (row: AdminOrderRow) => {
      const status = String(row.order_status ?? '').toLowerCase();
      const ref = row.id.slice(0, 8).toUpperCase();
      const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Open detail',
          onPress: () => {
            navigation.navigate('AdminPlatformOrderDetail', { orderId: row.id });
          },
        },
      ];
      if (status !== 'collected' && status !== 'completed' && status !== 'cancelled') {
        buttons.unshift({
          text: 'Mark collected',
          onPress: () => {
            void updateOrderStatus(row.id, 'collected');
          },
        });
        buttons.unshift({
          text: 'Cancel order',
          style: 'destructive',
          onPress: () => {
            void updateOrderStatus(row.id, 'cancelled');
          },
        });
      }
      Alert.alert(
        `Order #${ref}`,
        `${row.customer_name} · ${row.merchant_name}\nRs. ${Math.round(Number(row.total ?? 0)).toLocaleString()} · ${row.order_status ?? 'unknown'}`,
        buttons,
      );
    },
    [navigation, updateOrderStatus],
  );

  if (loading) {
    return <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />;
  }
  if (err) {
    return <PolicyHint message={err} />;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((item, idx) => {
        const isBusy = busyId === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => openRowActions(item)}
            disabled={isBusy}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              marginHorizontal: -spacing.sm,
              borderRadius: radii.default,
              borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.divider,
              opacity: isBusy ? 0.5 : 1,
              gap: 2,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <StitchText variant="label" colorKey="primaryContainer">
                #{item.id.slice(0, 8)}
              </StitchText>
              <StitchText variant="label" colorKey="text">
                Rs. {Math.round(Number(item.total ?? 0)).toLocaleString()}
              </StitchText>
            </View>
            <StitchText variant="body-sm" colorKey="textMuted">
              {item.customer_name} · {item.merchant_name}
            </StitchText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <StitchText variant="body-sm" colorKey="textMuted">
                {item.order_status ?? 'unknown'}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </StitchText>
            </View>
          </Pressable>
        );
      })}
      {rows.length === 0 ? (
        <StitchText variant="body-sm" colorKey="textMuted">
          No orders match this filter.
        </StitchText>
      ) : null}
    </View>
  );
}

export function AdminPlatformOrdersScreen() {
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminPlatformOrders'>>();
  const navigation = useNavigation<AdminNav>();

  useLayoutEffect(() => {
    const fromDashboard = route.params?.fromDashboard === true;
    if (!fromDashboard && navigation.canGoBack()) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to admin dashboard"
          onPress={() => navigateToAdminHome(navigation.getParent() as AdminCrossTabNavigation)}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <StitchIcon name="arrow_back" size={24} colorKey="primaryContainer" />
        </Pressable>
      ),
    });
  }, [navigation, route.params?.fromDashboard]);
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'reserved' | 'collected' | 'cancelled'
  >('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, gross: 0 });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortKey, setSortKey] = useState<AdminOrdersSortKey>('createdAt:desc');
  const rawDay = route.params?.day;
  const day: string | null =
    typeof rawDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : null;
  const dayLabel = useMemo(() => {
    if (!day) return null;
    const parsed = new Date(`${day}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }, [day]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, query, day]);

  const clearDayFilter = useCallback(() => {
    navigation.setParams({ day: undefined });
  }, [navigation]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_ORDERS_PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * ADMIN_ORDERS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * ADMIN_ORDERS_PAGE_SIZE);

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Platform orders</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Monitor and manage network transactions.
      </StitchText>
      {dayLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear date filter (showing orders for ${dayLabel})`}
          onPress={clearDayFilter}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.primaryHighlight,
          }}
        >
          <StitchIcon name="calendar_month" size={14} colorKey="primary" />
          <StitchText variant="label" colorKey="primary">
            Showing orders for {dayLabel}
          </StitchText>
          <StitchIcon name="close" size={14} colorKey="primary" />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <View
          style={{
            flex: 1,
            minWidth: 220,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search order id or reservation code…"
            placeholderTextColor={colors.textFaint}
            style={{
              minHeight: 40,
              color: colors.text,
              fontSize: 14,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          {([
            ['all', 'All'],
            ['reserved', 'Reserved'],
            ['collected', 'Collected'],
            ['cancelled', 'Cancelled'],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setStatusFilter(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: colors.divider,
                backgroundColor:
                  statusFilter === key ? colors.surfaceContainerHighest : colors.surface,
              }}
            >
              <StitchText
                variant="label"
                colorKey={statusFilter === key ? 'text' : 'textMuted'}
              >
                {label}
              </StitchText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StitchSurface elevated padding="md" style={{ flex: 1 }}>
          <StitchText variant="label" colorKey="textMuted">Page orders</StitchText>
          <StitchText variant="display" colorKey="text">{String(stats.total)}</StitchText>
        </StitchSurface>
        <StitchSurface elevated padding="md" style={{ flex: 1 }}>
          <StitchText variant="label" colorKey="textMuted">Pending rescues</StitchText>
          <StitchText variant="display" colorKey="text">{String(stats.pending)}</StitchText>
        </StitchSurface>
        <StitchSurface elevated padding="md" style={{ flex: 1 }}>
          <StitchText variant="label" colorKey="textMuted">Page value</StitchText>
          <StitchText variant="display" colorKey="text">
            Rs. {Math.round(stats.gross).toLocaleString()}
          </StitchText>
        </StitchSurface>
      </View>
      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <StitchText variant="h3" colorKey="text">Recent orders</StitchText>
          <StitchText variant="body-sm" colorKey="textMuted">
            Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()}
          </StitchText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginTop: spacing.sm,
          }}
        >
          <StitchText variant="label-caps" colorKey="textMuted" style={{ marginRight: 4 }}>
            Sort by
          </StitchText>
          {(
            [
              ['createdAt:desc', 'Newest'],
              ['createdAt:asc', 'Oldest'],
              ['total:desc', 'Total ↓'],
              ['total:asc', 'Total ↑'],
            ] as const
          ).map(([key, label]) => {
            const on = sortKey === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSortKey(key)}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: on ? colors.primaryHighlight : colors.surface,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.outlineVariant,
                }}
              >
                <StitchText
                  variant="label"
                  colorKey={on ? 'primaryContainer' : 'textMuted'}
                  style={{ fontSize: 12 }}
                >
                  {label}
                </StitchText>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <OrdersList
            query={query}
            statusFilter={statusFilter}
            day={day}
            page={page}
            sortKey={sortKey}
            onStats={setStats}
            onCountChange={setTotalCount}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <Pressable
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              borderRadius: radii.default,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            <StitchIcon name="chevron_left" size={16} colorKey="textMuted" />
            <StitchText variant="label" colorKey="textMuted">Previous</StitchText>
          </Pressable>
          <StitchText variant="body-sm" colorKey="textMuted">
            Page {page} of {totalPages}
          </StitchText>
          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              borderRadius: radii.default,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            <StitchText variant="label" colorKey="textMuted">Next</StitchText>
            <StitchIcon name="chevron_right" size={16} colorKey="textMuted" />
          </Pressable>
        </View>
      </StitchSurface>
    </StitchScreen>
  );
}

type PlatformChangeEntry = {
  id: string;
  occurred_at: string | null;
  action: string;
  actor_role: string;
  actor_name: string;
  affected_key: string;
  before_value: string;
  after_value: string;
};

function formatPrimitiveValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return '—';
  }
}

function diffPlatformValues(
  oldV: Record<string, unknown> | null | undefined,
  newV: Record<string, unknown> | null | undefined,
): { key: string; before: unknown; after: unknown } {
  const keys = new Set<string>([
    ...Object.keys(oldV ?? {}),
    ...Object.keys(newV ?? {}),
  ]);
  for (const k of keys) {
    const a = (oldV ?? {})[k];
    const b = (newV ?? {})[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      return { key: k, before: a, after: b };
    }
  }
  return { key: '—', before: null, after: null };
}

function formatRelativeTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AdminPlatformConfigScreen() {
  const navigation = useNavigation<AdminNav>();
  const { env, user } = useAuthContext();
  const { spacing, colors } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);
  const [savedFlags, setSavedFlags] = useState<PlatformFlags>(DEFAULT_PLATFORM_FLAGS);
  const [draftFlags, setDraftFlags] = useState<PlatformFlags>(DEFAULT_PLATFORM_FLAGS);
  const [changeLog, setChangeLog] = useState<PlatformChangeEntry[]>([]);
  const [changeLogError, setChangeLogError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<{
    ok: boolean;
    latencyMs: number | null;
    checkedAt: number;
  }>({ ok: true, latencyMs: null, checkedAt: 0 });
  const [commissionInput, setCommissionInput] = useState<string>(
    String(DEFAULT_PLATFORM_FLAGS.commission_rate),
  );
  const commissionInvalid = (() => {
    const n = Number(commissionInput);
    return Number.isFinite(n) && (n < 0 || n > 100);
  })();

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('platform_settings')
        .select('value')
        .eq('key', 'flags')
        .maybeSingle();
      if (!m) return;
      if (error) {
        const isMissingTable =
          error.code === '42P01' ||
          (typeof error.message === 'string' && /does not exist/i.test(error.message));
        if (isMissingTable) {
          setPersistenceAvailable(false);
        }
      } else if (data?.value && typeof data.value === 'object') {
        const v = data.value as Partial<PlatformFlags>;
        const commissionRaw = Number(v.commission_rate ?? DEFAULT_PLATFORM_FLAGS.commission_rate);
        const budgetRaw = Number(v.promo_budget_cap ?? DEFAULT_PLATFORM_FLAGS.promo_budget_cap);
        const next: PlatformFlags = {
          maintenance: Boolean(v.maintenance ?? DEFAULT_PLATFORM_FLAGS.maintenance),
          merchant_signups: Boolean(
            v.merchant_signups ?? DEFAULT_PLATFORM_FLAGS.merchant_signups,
          ),
          fraud_guard_strict: Boolean(
            v.fraud_guard_strict ?? DEFAULT_PLATFORM_FLAGS.fraud_guard_strict,
          ),
          payout_cycle: normalizePayoutCycle(v.payout_cycle),
          commission_rate: Number.isFinite(commissionRaw)
            ? commissionRaw
            : DEFAULT_PLATFORM_FLAGS.commission_rate,
          promo_budget_cap: Number.isFinite(budgetRaw)
            ? budgetRaw
            : DEFAULT_PLATFORM_FLAGS.promo_budget_cap,
        };
        setSavedFlags(next);
        setDraftFlags(next);
        setCommissionInput(String(next.commission_rate));
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok]);

  // Live system status ping — uses a cheap select on platform_settings (or orders
  // as a fallback) and times the round trip. Re-runs every 30s while the screen
  // is mounted.
  useEffect(() => {
    if (!ok) return;
    let cancelled = false;
    const sb = getSupabase(env);
    const ping = async () => {
      const started = Date.now();
      let healthy = false;
      try {
        const probe = await sb
          .from('platform_settings')
          .select('key', { head: true, count: 'exact' })
          .limit(1);
        healthy = !probe.error || probe.error.code === '42P01';
        if (probe.error && probe.error.code === '42P01') {
          const fallback = await sb
            .from('orders')
            .select('id', { head: true, count: 'exact' })
            .limit(1);
          healthy = !fallback.error;
        }
      } catch {
        healthy = false;
      }
      const elapsed = Date.now() - started;
      if (cancelled) return;
      setSystemStatus({ ok: healthy, latencyMs: elapsed, checkedAt: Date.now() });
    };
    void ping();
    const id = setInterval(() => void ping(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [env, ok]);

  const loadChangeLog = useCallback(async () => {
    const sb = getSupabase(env);
    const { data, error } = await sb
      .from('audit_logs')
      .select(
        'id, occurred_at, action, actor_role, actor_id, metadata, actor:profiles!audit_logs_actor_id_fkey(full_name)',
      )
      .eq('kind', 'platform_settings')
      .order('occurred_at', { ascending: false })
      .limit(10);
    if (error) {
      setChangeLog([]);
      setChangeLogError(error.message);
      return;
    }
    setChangeLogError(null);
    const mapped: PlatformChangeEntry[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const md = (r.metadata && typeof r.metadata === 'object'
        ? (r.metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const oldV = md.old_value as Record<string, unknown> | null | undefined;
      const newV = md.new_value as Record<string, unknown> | null | undefined;
      const diff = diffPlatformValues(oldV, newV);
      const actor = r.actor as Record<string, unknown> | undefined;
      return {
        id: String(r.id ?? ''),
        occurred_at: typeof r.occurred_at === 'string' ? r.occurred_at : null,
        action: String(r.action ?? 'updated'),
        actor_role: String(r.actor_role ?? 'system'),
        actor_name:
          actor?.full_name != null && String(actor.full_name).trim()
            ? String(actor.full_name)
            : 'System',
        affected_key:
          typeof md.key === 'string' && md.key
            ? `${md.key}.${diff.key}`
            : diff.key,
        before_value: formatPrimitiveValue(diff.before),
        after_value: formatPrimitiveValue(diff.after),
      };
    });
    setChangeLog(mapped);
  }, [env]);

  useEffect(() => {
    if (!ok) return;
    void loadChangeLog();
  }, [loadChangeLog, ok]);

  const dirty =
    draftFlags.fraud_guard_strict !== savedFlags.fraud_guard_strict ||
    draftFlags.maintenance !== savedFlags.maintenance ||
    draftFlags.merchant_signups !== savedFlags.merchant_signups ||
    draftFlags.payout_cycle !== savedFlags.payout_cycle ||
    draftFlags.commission_rate !== savedFlags.commission_rate ||
    draftFlags.promo_budget_cap !== savedFlags.promo_budget_cap;

  const toggle = useCallback(
    (key: keyof PlatformFlags, value: boolean) => {
      setDraftFlags((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const onSave = useCallback(async () => {
    if (!persistenceAvailable) {
      Alert.alert(
        'Persistence not available',
        '`public.platform_settings` is missing. Apply `docs/supabase/platform_settings.sql` to enable saving.',
      );
      return;
    }
    setSaving(true);
    const sb = getSupabase(env);
    const { error } = await sb
      .from('platform_settings')
      .upsert(
        {
          key: 'flags',
          value: draftFlags,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setSavedFlags(draftFlags);
    void loadChangeLog();
  }, [env, draftFlags, loadChangeLog, persistenceAvailable, user?.id]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Platform configuration</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Commission structures, payout cycles, and global controls. Toggles persist to `platform_settings.flags` (jsonb).
      </StitchText>

      {!persistenceAvailable ? (
        <StitchSurface elevated padding="md" style={{ backgroundColor: colors.accentHighlight }}>
          <StitchText variant="label-caps" colorKey="accent">Persistence pending</StitchText>
          <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 4 }}>
            `public.platform_settings` is missing. Apply `docs/supabase/platform_settings.sql` to enable saving.
          </StitchText>
        </StitchSurface>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StitchButton
          variant="secondary"
          title="Audit log"
          onPress={() => navigation.navigate('AdminAuditLogs')}
          style={{ flex: 1 }}
        />
        <StitchButton
          variant="primary"
          title={saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          disabled={!dirty || saving || loading}
          onPress={() => void onSave()}
          style={{ flex: 1 }}
        />
      </View>

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: colors.surfaceContainerLow,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StitchIcon
              name={systemStatus.ok ? 'cloud_done' : 'cloud_off'}
              size={22}
              color={systemStatus.ok ? colors.accent : colors.error}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StitchText variant="h3" colorKey="text">
                System status: {systemStatus.ok ? 'Optimal' : 'Degraded'}
              </StitchText>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: systemStatus.ok ? colors.accent : colors.error,
                }}
              />
            </View>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
              {systemStatus.checkedAt
                ? `Last checked ${new Date(systemStatus.checkedAt).toLocaleTimeString()}${
                    systemStatus.latencyMs != null
                      ? ` · DB ping ${systemStatus.latencyMs}ms`
                      : ''
                  }`
                : 'Checking core services…'}
            </StitchText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          <View>
            <StitchText variant="label-caps" colorKey="textMuted">API</StitchText>
            <StitchText variant="label" colorKey="text">
              {systemStatus.ok ? 'Online' : 'Unreachable'}
            </StitchText>
          </View>
          <View>
            <StitchText variant="label-caps" colorKey="textMuted">DB latency</StitchText>
            <StitchText variant="label" colorKey="text">
              {systemStatus.latencyMs != null ? `${systemStatus.latencyMs}ms` : '—'}
            </StitchText>
          </View>
          <View>
            <StitchText variant="label-caps" colorKey="textMuted">Persistence</StitchText>
            <StitchText variant="label" colorKey="text">
              {persistenceAvailable ? 'Ready' : 'Missing'}
            </StitchText>
          </View>
        </View>
      </StitchSurface>

      {commissionInvalid ? (
        <StitchSurface
          elevated
          padding="md"
          style={{
            borderWidth: 1,
            borderColor: colors.error,
            backgroundColor: colors.errorContainer,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StitchIcon name="warning" size={20} color={colors.error} />
            <View style={{ flex: 1 }}>
              <StitchText variant="label" colorKey="error">
                Invalid commission rate
              </StitchText>
              <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 2 }}>
                Commission must be between 0 and 100. The saved value is clamped to{' '}
                {Math.max(0, Math.min(100, Number(commissionInput) || 0))}%.
              </StitchText>
            </View>
          </View>
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">Commission structure</StitchText>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Standard tier</StitchText>
            <StitchText variant="h2" colorKey="text">15.0%</StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Premium tier</StitchText>
            <StitchText variant="h2" colorKey="secondary">12.5%</StitchText>
          </View>
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Payout cycle</StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          How often merchant settlements are scheduled.
        </StitchText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {([
            ['weekly', 'Weekly'],
            ['fortnightly', 'Fortnightly'],
            ['monthly', 'Monthly'],
          ] as const).map(([key, label]) => {
            const on = draftFlags.payout_cycle === key;
            return (
              <Pressable
                key={key}
                onPress={() =>
                  setDraftFlags((prev) => ({ ...prev, payout_cycle: key }))
                }
                disabled={loading || saving}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? colors.primary : colors.outlineVariant,
                  backgroundColor: on ? colors.primaryHighlight : colors.surface,
                  opacity: loading || saving ? 0.6 : 1,
                }}
              >
                <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'textMuted'}>
                  {label}
                </StitchText>
              </Pressable>
            );
          })}
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Default platform commission</StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Percentage withheld on each settled order (0–100). Used as fallback when a merchant has no override.
        </StitchText>
        <View
          style={{
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: 8,
            paddingHorizontal: spacing.md,
            paddingVertical: 4,
          }}
        >
          <TextInput
            value={commissionInput}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.]/g, '');
              setCommissionInput(cleaned);
              const num = Number(cleaned);
              setDraftFlags((prev) => ({
                ...prev,
                commission_rate: Number.isFinite(num)
                  ? Math.max(0, Math.min(100, num))
                  : prev.commission_rate,
              }));
            }}
            keyboardType="numeric"
            placeholder="15"
            placeholderTextColor={colors.textMuted}
            editable={!loading && !saving}
            style={{ flex: 1, minHeight: 40, color: colors.text }}
          />
          <StitchText variant="label" colorKey="textMuted">%</StitchText>
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Promo budget cap</StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Maximum total Rs. promo spend allowed per cycle. Auto-pauses promos when exceeded.
        </StitchText>
        <View
          style={{
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: 8,
            paddingHorizontal: spacing.md,
            paddingVertical: 4,
          }}
        >
          <StitchText variant="label" colorKey="textMuted">Rs.</StitchText>
          <TextInput
            value={String(draftFlags.promo_budget_cap)}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.]/g, '');
              const num = Number(cleaned);
              setDraftFlags((prev) => ({
                ...prev,
                promo_budget_cap: Number.isFinite(num) ? Math.max(0, num) : prev.promo_budget_cap,
              }));
            }}
            keyboardType="numeric"
            placeholder="250000"
            placeholderTextColor={colors.textMuted}
            editable={!loading && !saving}
            style={{ flex: 1, minHeight: 40, color: colors.text }}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="label" colorKey="text">Maintenance mode</StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Disables checkout site-wide and shows a banner to all customers.
            </StitchText>
          </View>
          <Switch
            value={draftFlags.maintenance}
            onValueChange={(v) => toggle('maintenance', v)}
            disabled={loading || saving}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="label" colorKey="text">Merchant signups</StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Allow new merchants to start the onboarding flow.
            </StitchText>
          </View>
          <Switch
            value={draftFlags.merchant_signups}
            onValueChange={(v) => toggle('merchant_signups', v)}
            disabled={loading || saving}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <StitchText variant="label" colorKey="text">Fraud guard strict mode</StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Blocks suspicious checkout bursts pending manual review.
            </StitchText>
          </View>
          <Switch
            value={draftFlags.fraud_guard_strict}
            onValueChange={(v) => toggle('fraud_guard_strict', v)}
            disabled={loading || saving}
          />
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <StitchText variant="h3" colorKey="text">
              Recent platform changes
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Last 10 entries from `audit_logs` (kind=`platform_settings`).
            </StitchText>
          </View>
          <StitchIcon name="history" size={22} colorKey="textMuted" />
        </View>

        {changeLogError ? (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.errorContainer,
            }}
          >
            <StitchText variant="body-sm" colorKey="onErrorContainer">
              {changeLogError}
            </StitchText>
          </View>
        ) : null}

        {changeLog.length === 0 && !changeLogError ? (
          <StitchText
            variant="body-sm"
            colorKey="textMuted"
            style={{ marginTop: spacing.md }}
          >
            No platform changes recorded yet.
          </StitchText>
        ) : null}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {changeLog.map((entry, ix) => (
            <View
              key={entry.id}
              style={{
                paddingVertical: spacing.sm,
                borderBottomWidth: ix === changeLog.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StitchText variant="label" colorKey="text" numberOfLines={1}>
                  {entry.actor_name}
                </StitchText>
                <StitchText variant="body-sm" colorKey="textFaint">
                  {formatRelativeTimestamp(entry.occurred_at)}
                </StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1}>
                {entry.action} · {entry.affected_key}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {entry.before_value} → {entry.after_value}
              </StitchText>
            </View>
          ))}
        </View>
      </StitchSurface>

      <AdminSignOutFooter />
    </StitchScreen>
  );
}

export function AdminComplaintsScreen() {
  const navigation = useNavigation<AdminNav>();
  const { env, user } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [tab, setTab] = useState<'all' | 'unresolved' | 'escalated'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<
    {
      id: string;
      type: string;
      description: string;
      status: string;
      created_at: string | null;
      order_code: string;
      merchant_name: string;
      reporter_name: string;
    }[]
  >([]);

  const load = useCallback(async () => {
    const sb = getSupabase(env);
    const { data, error } = await sb
      .from('complaints')
      .select(
        `
        id,
        type,
        description,
        status,
        created_at,
        order:orders(reservation_code, outlet:outlets(name, merchant:merchants(business_name))),
        reporter:profiles!complaints_reporter_id_fkey(full_name)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setErr(null);
      const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => {
        const order = r.order as Record<string, unknown> | undefined;
        const outlet = order?.outlet as Record<string, unknown> | undefined;
        const merchant = outlet?.merchant as Record<string, unknown> | undefined;
        return {
          id: String(r.id ?? ''),
          type: String(r.type ?? 'Complaint'),
          description: String(r.description ?? ''),
          status: String(r.status ?? 'open'),
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          order_code: String(order?.reservation_code ?? '') || '—',
          merchant_name: String(merchant?.business_name ?? outlet?.name ?? '') || 'Merchant',
          reporter_name:
            String((r.reporter as Record<string, unknown> | undefined)?.full_name ?? '') ||
            'Customer',
        };
      });
      setRows(mapped);
    }
    setLoading(false);
  }, [env]);

  useEffect(() => {
    if (!ok) return;
    void load();
  }, [load, ok]);

  const counts = useMemo(() => {
    const s = (v: string) => v.trim().toLowerCase();
    const open = rows.filter((r) => isOpenComplaintStatus(r.status)).length;
    const unresolved = rows.filter((r) => ['unresolved', 'open'].includes(s(r.status))).length;
    const escalated = rows.filter((r) => s(r.status) === 'escalated').length;
    return { open, unresolved, escalated };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const s = (v: string) => v.trim().toLowerCase();
    const openOnly = rows.filter((r) => isOpenComplaintStatus(r.status));
    if (tab === 'all') return openOnly;
    if (tab === 'unresolved') return openOnly.filter((r) => ['unresolved', 'open'].includes(s(r.status)));
    if (tab === 'escalated') return openOnly.filter((r) => s(r.status) === 'escalated');
    return openOnly;
  }, [rows, tab]);

  const patchComplaint = useCallback(
    async (complaintId: string, patch: Record<string, unknown>) => {
      const sb = getSupabase(env);
      const { error } = await sb.from('complaints').update(patch).eq('id', complaintId);
      if (error) {
        setErr(error.message);
        return false;
      }
      void load();
      return true;
    },
    [env, load],
  );

  const resolveComplaint = useCallback(
    async (complaintId: string) => {
      await patchComplaint(complaintId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
        resolution: 'Resolved in-app',
      });
    },
    [patchComplaint, user?.id],
  );

  const escalateComplaint = useCallback(
    async (complaintId: string) => {
      await patchComplaint(complaintId, { status: 'escalated' });
    },
    [patchComplaint],
  );

  if (!ok) {
    return <AdminOnlyNotice />;
  }
  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Active complaints</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Review and resolve customer issues regarding rescue bags.
      </StitchText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {([
          ['all', `All Open (${counts.open})`],
          ['unresolved', `Unresolved (${counts.unresolved})`],
          ['escalated', `Escalated (${counts.escalated})`],
        ] as const).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                backgroundColor: on ? colors.surfaceContainerHighest : colors.surface,
                borderWidth: 1,
                borderColor: colors.divider,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'text' : 'textMuted'}>
                {label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />
      ) : err ? (
        <PolicyHint message={err} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {visibleRows.length === 0 ? (
            <StitchSurface elevated padding="md">
              <StitchText variant="body-md" colorKey="textMuted">
                No open complaints found for this filter (or blocked by RLS).
              </StitchText>
            </StitchSurface>
          ) : (
            visibleRows.map((c) => {
              const isHigh = String(c.type ?? '').toLowerCase().includes('missing');
              const statusNorm = c.status.trim().toLowerCase();
              const isEscalated = statusNorm === 'escalated';
              return (
                <StitchSurface key={c.id} elevated padding="md" style={{ overflow: 'hidden' }}>
                  <View
                    style={{
                      position: 'absolute' as const,
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      backgroundColor: isHigh ? colors.accent : colors.secondary,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('AdminComplaintDetail', { complaintId: c.id })
                    }
                    style={{ gap: 6 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <StitchText variant="h3" colorKey="text">{c.type}</StitchText>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: radii.full,
                            backgroundColor: isEscalated
                              ? colors.accentHighlight
                              : colors.errorContainer,
                          }}
                        >
                          <StitchText
                            variant="label-caps"
                            colorKey={isEscalated ? 'accent' : 'onErrorContainer'}
                          >
                            {complaintPriorityLabel(c.status)}
                          </StitchText>
                        </View>
                        <View
                          style={{
                            backgroundColor: colors.surfaceContainer,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: radii.default,
                          }}
                        >
                          <StitchText variant="label" colorKey="textMuted">
                            {c.order_code ? `#${c.order_code}` : '—'}
                          </StitchText>
                        </View>
                      </View>
                    </View>

                    <StitchText variant="body-md" colorKey="textMuted">
                      {c.description}
                    </StitchText>

                    <StitchText variant="body-sm" colorKey="textMuted">
                      {c.created_at ? `Reported ${new Date(c.created_at).toLocaleString()}` : 'Reported —'}
                    </StitchText>

                    <StitchText variant="body-sm" colorKey="textMuted">
                      Merchant: {c.merchant_name} · Reporter: {c.reporter_name}
                    </StitchText>
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                    <StitchButton
                      title="Resolve"
                      variant="primary"
                      onPress={() => {
                        void resolveComplaint(c.id);
                      }}
                      style={{ flex: 1 }}
                    />
                    <StitchButton
                      title="Escalate"
                      variant="secondary"
                      disabled={isEscalated}
                      onPress={() => {
                        void escalateComplaint(c.id);
                      }}
                      style={{ flex: 1 }}
                    />
                    <StitchButton
                      title="Details"
                      variant="secondary"
                      onPress={() => {
                        navigation.navigate('AdminComplaintDetail', { complaintId: c.id });
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </StitchSurface>
              );
            })
          )}
        </View>
      )}
    </StitchScreen>
  );
}

type AuditEvent = {
  id: string;
  kind: string;
  action: string;
  iconName:
    | 'check_circle'
    | 'add_circle'
    | 'delete'
    | 'payments'
    | 'warning'
    | 'block';
  iconBg: string;
  iconFg: string;
  title: string;
  detail: string;
  actor: string;
  at: string | null;
  /**
   * Raw `metadata` jsonb from `public.audit_logs.metadata`. Surfaces in the per-row
   * **More** modal so admins can see the structured before/after / context payload that
   * the audit triggers capture but the summary list omits. May be `null` for rows that
   * predate the metadata column or that didn't capture any extra context.
   */
  metadata: Record<string, unknown> | null;
};

const AUDIT_LOGS_PAGE_SIZE = 30;

export function AdminAuditLogsScreen() {
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'merchant' | 'complaint' | 'settlement' | 'order' | 'profile'>('all');
  const [rangeFilter, setRangeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('30d');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  /**
   * Selected audit row whose raw `metadata` jsonb is shown inside the **More** modal.
   * `null` keeps the modal closed. Triggered by the `more_horiz` affordance on each row.
   */
  const [metadataEvent, setMetadataEvent] = useState<AuditEvent | null>(null);

  useEffect(() => {
    setPage(1);
  }, [kindFilter, query, rangeFilter]);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const from = (page - 1) * AUDIT_LOGS_PAGE_SIZE;
      const to = from + AUDIT_LOGS_PAGE_SIZE - 1;
      let req = sb
        .from('audit_logs')
        .select(
          'id, occurred_at, kind, action, title, detail, actor_role, metadata',
          { count: 'exact' },
        )
        .order('occurred_at', { ascending: false })
        .range(from, to);
      if (kindFilter !== 'all') {
        req = req.eq('kind', kindFilter);
      }
      if (rangeFilter !== 'all') {
        const hours =
          rangeFilter === '24h' ? 24 : rangeFilter === '7d' ? 24 * 7 : 24 * 30;
        const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
        req = req.gte('occurred_at', cutoff);
      }
      const trimmed = query.trim();
      if (trimmed) {
        const escaped = trimmed.replace(/[%,]/g, '');
        req = req.or(`title.ilike.%${escaped}%,detail.ilike.%${escaped}%,actor_role.ilike.%${escaped}%`);
      }
      const { data, error, count } = await req;
      if (!m) return;
      if (error) {
        setErr(error.message);
        setEvents([]);
      } else {
        const styleForKind = (kind: string, action: string) => {
          const k = kind.toLowerCase();
          const a = action.toLowerCase();
          if (k === 'merchant') {
            if (a === 'approved') return { iconName: 'check_circle' as const, iconBg: colors.primaryHighlight, iconFg: colors.primary };
            if (a === 'rejected' || a === 'suspended') return { iconName: 'block' as const, iconBg: colors.errorContainer, iconFg: colors.error };
            return { iconName: 'warning' as const, iconBg: colors.accentHighlight, iconFg: colors.accent };
          }
          if (k === 'complaint') {
            if (a === 'resolved') return { iconName: 'check_circle' as const, iconBg: colors.primaryHighlight, iconFg: colors.primary };
            return { iconName: 'warning' as const, iconBg: colors.errorContainer, iconFg: colors.error };
          }
          if (k === 'settlement') return { iconName: 'payments' as const, iconBg: colors.surfaceContainer, iconFg: colors.primary };
          if (k === 'order') return { iconName: 'delete' as const, iconBg: colors.errorContainer, iconFg: colors.error };
          if (k === 'profile') return { iconName: 'block' as const, iconBg: colors.errorContainer, iconFg: colors.error };
          return { iconName: 'add_circle' as const, iconBg: colors.surfaceContainer, iconFg: colors.textMuted };
        };
        const mapped: AuditEvent[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
          const kind = String(r.kind ?? 'event');
          const action = String(r.action ?? '');
          const style = styleForKind(kind, action);
          return {
            id: String(r.id ?? ''),
            kind,
            action,
            iconName: style.iconName,
            iconBg: style.iconBg,
            iconFg: style.iconFg,
            title: String(r.title ?? `${kind} ${action}`),
            detail: String(r.detail ?? ''),
            actor: String(r.actor_role ?? 'system'),
            at: typeof r.occurred_at === 'string' ? (r.occurred_at as string) : null,
            metadata:
              r.metadata && typeof r.metadata === 'object'
                ? (r.metadata as Record<string, unknown>)
                : null,
          };
        });
        setErr(null);
        setEvents(mapped);
        if (typeof count === 'number') {
          setTotalCount(count);
        }
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [
    env,
    ok,
    page,
    kindFilter,
    rangeFilter,
    query,
    colors.accent,
    colors.accentHighlight,
    colors.error,
    colors.errorContainer,
    colors.primary,
    colors.primaryHighlight,
    colors.surfaceContainer,
    colors.textMuted,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_LOGS_PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * AUDIT_LOGS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * AUDIT_LOGS_PAGE_SIZE);

  const filtered = events;

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Audit logs</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Detailed history of platform operations and changes.
      </StitchText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radii.default,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
        }}
      >
        <StitchIcon name="search" size={18} colorKey="textMuted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title, detail, actor…"
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, minHeight: 40 }}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {([
          ['all', 'All'],
          ['merchant', 'Merchants'],
          ['complaint', 'Complaints'],
          ['settlement', 'Settlements'],
          ['order', 'Orders'],
          ['profile', 'Profiles'],
        ] as const).map(([key, label]) => {
          const on = kindFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setKindFilter(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                backgroundColor: on ? colors.surfaceContainerHighest : colors.surface,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'text' : 'textMuted'}>
                {label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {([
          ['24h', 'Last 24h'],
          ['7d', 'Last 7 days'],
          ['30d', 'Last 30 days'],
          ['all', 'All time'],
        ] as const).map(([key, label]) => {
          const on = rangeFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setRangeFilter(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                backgroundColor: on ? colors.primaryHighlight : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.outlineVariant,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'primaryContainer' : 'textMuted'}>
                {label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />
      ) : err ? (
        <PolicyHint message={err} />
      ) : (
        <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <StitchText variant="label-caps" colorKey="textMuted">
              Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()}
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted">
              Page {page} of {totalPages}
            </StitchText>
          </View>

          {filtered.length === 0 ? (
            <StitchText variant="body-md" colorKey="textMuted" style={{ paddingTop: spacing.md }}>
              No matching events.
            </StitchText>
          ) : (
            filtered.map((e, idx) => (
              <View
                key={e.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderBottomWidth: idx === filtered.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    backgroundColor: e.iconBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StitchIcon name={e.iconName} size={18} color={e.iconFg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <StitchText variant="label" colorKey="text" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {e.title}
                    </StitchText>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radii.full,
                        backgroundColor: colors.surfaceContainer,
                      }}
                    >
                      <StitchText variant="label-caps" colorKey="textMuted">
                        {e.kind}
                      </StitchText>
                    </View>
                    {e.action ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radii.full,
                          backgroundColor: colors.primaryHighlight,
                        }}
                      >
                        <StitchText variant="label-caps" colorKey="primary">
                          {e.action}
                        </StitchText>
                      </View>
                    ) : null}
                  </View>
                  <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={3}>
                    {e.detail || '—'}
                  </StitchText>
                  {e.metadata && Object.keys(e.metadata).length > 0 ? (
                    <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
                      {Object.entries(e.metadata)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                        .join(' · ')}
                    </StitchText>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {e.actor}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {e.at ? new Date(e.at).toLocaleString() : '—'}
                    </StitchText>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    e.metadata
                      ? 'Show audit metadata'
                      : 'Show audit details'
                  }
                  onPress={() => setMetadataEvent(e)}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <StitchIcon
                    name="more_horiz"
                    size={20}
                    colorKey="textMuted"
                  />
                </Pressable>
              </View>
            ))
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
            }}
          >
            <Pressable
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.default,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <StitchIcon name="chevron_left" size={16} colorKey="textMuted" />
              <StitchText variant="label" colorKey="textMuted">Previous</StitchText>
            </Pressable>
            <Pressable
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.default,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              <StitchText variant="label" colorKey="textMuted">Next</StitchText>
              <StitchIcon name="chevron_right" size={16} colorKey="textMuted" />
            </Pressable>
          </View>
        </StitchSurface>
      )}

      <Modal
        visible={metadataEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMetadataEvent(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingHorizontal: spacing.pageMarginMobile,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.md,
              maxHeight: '85%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <StitchIcon
                  name="data_object"
                  size={20}
                  colorKey="textMuted"
                />
                <StitchText variant="h3" colorKey="text">
                  Audit event metadata
                </StitchText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close metadata"
                onPress={() => setMetadataEvent(null)}
                hitSlop={8}
              >
                <StitchIcon name="close" size={22} colorKey="text" />
              </Pressable>
            </View>
            <View>
              <StitchText variant="label-caps" colorKey="textMuted">
                {metadataEvent?.kind?.toUpperCase() ?? ''}
                {metadataEvent?.action ? ` · ${metadataEvent.action}` : ''}
              </StitchText>
              <StitchText variant="label" colorKey="text">
                {metadataEvent?.title ?? ''}
              </StitchText>
              {metadataEvent?.detail ? (
                <StitchText variant="body-sm" colorKey="textMuted">
                  {metadataEvent.detail}
                </StitchText>
              ) : null}
              <StitchText
                variant="body-sm"
                colorKey="textMuted"
                style={{ marginTop: 4 }}
              >
                {metadataEvent?.actor ?? 'system'} ·{' '}
                {metadataEvent?.at
                  ? new Date(metadataEvent.at).toLocaleString()
                  : '—'}
              </StitchText>
            </View>
            <ScrollView
              style={{
                maxHeight: 320,
                backgroundColor: colors.surfaceContainerLow,
                borderRadius: radii.default,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.divider,
              }}
            >
              <StitchText
                variant="body-sm"
                colorKey="text"
                style={{ fontFamily: 'Courier' }}
              >
                {metadataEvent?.metadata
                  ? JSON.stringify(metadataEvent.metadata, null, 2)
                  : '// No structured metadata captured for this event.'}
              </StitchText>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </StitchScreen>
  );
}

type PayoutCycle = 'weekly' | 'fortnightly' | 'monthly';

type PlatformFlags = {
  maintenance: boolean;
  merchant_signups: boolean;
  fraud_guard_strict: boolean;
  payout_cycle: PayoutCycle;
  commission_rate: number; // percent (0..100)
  promo_budget_cap: number; // LKR
};

const DEFAULT_PLATFORM_FLAGS: PlatformFlags = {
  maintenance: false,
  merchant_signups: true,
  fraud_guard_strict: true,
  payout_cycle: 'weekly',
  commission_rate: 15,
  promo_budget_cap: 250000,
};

function normalizePayoutCycle(raw: unknown): PayoutCycle {
  if (raw === 'fortnightly' || raw === 'monthly') return raw;
  return 'weekly';
}

type BooleanFlagKey = 'maintenance' | 'merchant_signups' | 'fraud_guard_strict';

export function AdminSystemSettingsScreen() {
  const { env, user } = useAuthContext();
  const { spacing, colors } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [flags, setFlags] = useState<PlatformFlags>(DEFAULT_PLATFORM_FLAGS);
  const [loading, setLoading] = useState(true);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<BooleanFlagKey | null>(null);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      const sb = getSupabase(env);
      const { data, error } = await sb
        .from('platform_settings')
        .select('value')
        .eq('key', 'flags')
        .maybeSingle();
      if (!m) return;
      if (error) {
        const isMissingTable =
          error.code === '42P01' ||
          (typeof error.message === 'string' && /does not exist/i.test(error.message));
        if (isMissingTable) {
          setPersistenceAvailable(false);
        } else {
          setErr(error.message);
        }
      } else if (data?.value && typeof data.value === 'object') {
        const v = data.value as Partial<PlatformFlags>;
        const commissionRaw = Number(v.commission_rate ?? DEFAULT_PLATFORM_FLAGS.commission_rate);
        const budgetRaw = Number(v.promo_budget_cap ?? DEFAULT_PLATFORM_FLAGS.promo_budget_cap);
        setFlags({
          maintenance: Boolean(v.maintenance ?? DEFAULT_PLATFORM_FLAGS.maintenance),
          merchant_signups: Boolean(v.merchant_signups ?? DEFAULT_PLATFORM_FLAGS.merchant_signups),
          fraud_guard_strict: Boolean(v.fraud_guard_strict ?? DEFAULT_PLATFORM_FLAGS.fraud_guard_strict),
          payout_cycle: normalizePayoutCycle(v.payout_cycle),
          commission_rate: Number.isFinite(commissionRaw)
            ? commissionRaw
            : DEFAULT_PLATFORM_FLAGS.commission_rate,
          promo_budget_cap: Number.isFinite(budgetRaw)
            ? budgetRaw
            : DEFAULT_PLATFORM_FLAGS.promo_budget_cap,
        });
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok]);

  const updateFlag = useCallback(
    async (key: BooleanFlagKey, value: boolean) => {
      setFlags((prev) => ({ ...prev, [key]: value }));
      if (!persistenceAvailable) return;
      setSavingKey(key);
      const sb = getSupabase(env);
      const nextFlags = { ...flags, [key]: value };
      const { error } = await sb.from('platform_settings').upsert(
        {
          key: 'flags',
          value: nextFlags,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: 'key' },
      );
      setSavingKey(null);
      if (error) {
        setErr(error.message);
        Alert.alert('Save failed', error.message);
      }
    },
    [env, flags, persistenceAvailable, user?.id],
  );

  const row: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Platform settings</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Global toggles and guardrails. Persists to `public.platform_settings` (admin-only RLS).
      </StitchText>

      {!persistenceAvailable ? (
        <StitchSurface
          elevated
          padding="md"
          style={{ borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentHighlight }}
        >
          <StitchText variant="label" colorKey="text">Persistence pending</StitchText>
          <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 4 }}>
            `public.platform_settings` not found. Toggles are in-memory only. Apply
            `docs/supabase/platform_settings.sql` to enable persistence.
          </StitchText>
        </StitchSurface>
      ) : null}

      {err ? <PolicyHint message={err} /> : null}

      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : (
        <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
          <View style={row}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <StitchText variant="label" colorKey="text">Maintenance mode</StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">Show maintenance banner to all users.</StitchText>
              {savingKey === 'maintenance' ? (
                <StitchText variant="body-sm" colorKey="textMuted">Saving…</StitchText>
              ) : null}
            </View>
            <Switch
              value={flags.maintenance}
              onValueChange={(v) => void updateFlag('maintenance', v)}
            />
          </View>
          <View style={[row, { marginTop: spacing.md }]}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <StitchText variant="label" colorKey="text">Merchant signups</StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">Allow new merchant applications.</StitchText>
              {savingKey === 'merchant_signups' ? (
                <StitchText variant="body-sm" colorKey="textMuted">Saving…</StitchText>
              ) : null}
            </View>
            <Switch
              value={flags.merchant_signups}
              onValueChange={(v) => void updateFlag('merchant_signups', v)}
            />
          </View>
          <View style={[row, { marginTop: spacing.md }]}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <StitchText variant="label" colorKey="text">Fraud guard strict mode</StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">Blocks suspicious checkout bursts pending manual review.</StitchText>
              {savingKey === 'fraud_guard_strict' ? (
                <StitchText variant="body-sm" colorKey="textMuted">Saving…</StitchText>
              ) : null}
            </View>
            <Switch
              value={flags.fraud_guard_strict}
              onValueChange={(v) => void updateFlag('fraud_guard_strict', v)}
            />
          </View>
        </StitchSurface>
      )}

      <AdminSignOutFooter />
    </StitchScreen>
  );
}

type MerchantRow = {
  id: string;
  business_name: string;
  status: string;
  created_at: string | null;
  rescues: number;
  contact_email: string;
  contact_phone: string;
};

/**
 * Render a 2-col image grid for outlet/evidence photos. Falls back to an icon tile when an
 * image fails to load (network error, broken URL, signed-URL expiry). Used by
 * AdminApplicationReview, AdminMerchantDetail, and (variant) AdminComplaintDetail.
 */
function OutletPhotoGrid({
  urls,
  columns = 2,
  onTap,
}: {
  urls: string[];
  columns?: number;
  onTap?: (url: string) => void;
}): React.ReactElement | null {
  const { spacing, colors, radii } = useStitchTheme();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!urls || urls.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {urls.map((url, idx) => {
        const isBad = failed[url] || !/^https?:\/\//i.test(url);
        const widthPct: `${number}%` = `${100 / columns - 2}%`;
        const Wrap = onTap && !isBad ? Pressable : View;
        return (
          <Wrap
            key={`${idx}-${url}`}
            accessibilityRole={onTap && !isBad ? 'button' : undefined}
            onPress={onTap && !isBad ? () => onTap(url) : undefined}
            style={{
              width: widthPct,
              aspectRatio: 1,
              borderRadius: radii.default,
              overflow: 'hidden',
              backgroundColor: colors.surfaceContainer,
              borderWidth: 1,
              borderColor: colors.divider,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isBad ? (
              <View style={{ alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm }}>
                <StitchIcon name="image" size={24} colorKey="textMuted" />
                <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1} style={{ maxWidth: '100%' }}>
                  No preview
                </StitchText>
              </View>
            ) : (
              <Image
                source={{ uri: url }}
                onError={() => setFailed((prev) => ({ ...prev, [url]: true }))}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel="Evidence preview"
              />
            )}
          </Wrap>
        );
      })}
    </View>
  );
}

function complaintPriorityLabel(status: string): string {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'escalated') return 'Escalated';
  if (s === 'unresolved' || s === 'open') return 'Unresolved';
  return 'Open';
}

function ComplaintEvidenceGrid({ urls }: { urls: string[] }): React.ReactElement | null {
  const { spacing, colors, radii } = useStitchTheme();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  if (!urls || urls.length === 0) return null;

  const lightboxUrl = lightboxIdx != null ? urls[lightboxIdx] : null;
  const lightboxBad = lightboxIdx != null ? failed[lightboxIdx] : false;

  return (
    <View style={{ gap: spacing.sm }}>
      <Modal
        visible={lightboxIdx != null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxIdx(null)}
      >
        <Pressable
          onPress={() => setLightboxIdx(null)}
          style={{
            flex: 1,
            backgroundColor: colors.scrim,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.md,
          }}
        >
          {lightboxUrl ? (
            lightboxBad || !/^https?:\/\//i.test(lightboxUrl) ? (
              <StitchIcon name="image" size={48} colorKey="onPrimary" />
            ) : (
              <Image
                source={{ uri: lightboxUrl }}
                onError={() =>
                  setFailed((prev) => ({ ...prev, [lightboxIdx as number]: true }))
                }
                resizeMode="contain"
                style={{ width: '100%', height: '80%' }}
                accessibilityLabel="Evidence full screen"
              />
            )
          ) : null}
        </Pressable>
      </Modal>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {urls.map((url, idx) => {
          const isBad = failed[idx] || !/^https?:\/\//i.test(url);
          return (
            <Pressable
              key={`${idx}-${url}`}
              onPress={() => setLightboxIdx(idx)}
              style={({ pressed }) => ({
                width: '31%',
                aspectRatio: 1,
                borderRadius: radii.default,
                overflow: 'hidden',
                backgroundColor: colors.surfaceContainer,
                borderWidth: 1,
                borderColor: colors.divider,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {isBad ? (
                <StitchIcon name="image" size={24} colorKey="textMuted" />
              ) : (
                <Image
                  source={{ uri: url }}
                  onError={() => setFailed((prev) => ({ ...prev, [idx]: true }))}
                  resizeMode="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityLabel={`Evidence ${idx + 1} preview`}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function statusPillTokens(
  status: string,
  colors: ReturnType<typeof useStitchTheme>['colors'],
): { bg: string; fg: string; dot: string } {
  const s = status.trim().toLowerCase();
  if (s === 'approved' || s === 'live' || s === 'active') {
    return { bg: colors.primaryHighlight, fg: colors.primary, dot: colors.primary };
  }
  if (s === 'pending' || s === 'submitted' || s === 'in_review') {
    return { bg: colors.accentHighlight, fg: colors.accent, dot: colors.accent };
  }
  if (s === 'suspended' || s === 'rejected' || s === 'blocked') {
    return { bg: colors.errorContainer, fg: colors.error, dot: colors.error };
  }
  return {
    bg: colors.surfaceContainerHighest,
    fg: colors.textMuted,
    dot: colors.textMuted,
  };
}

const ADMIN_MERCHANTS_PAGE_SIZE = 20;

export function AdminMerchantsScreen() {
  const navigation = useNavigation<AdminNav>();
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'suspended'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageStats, setPageStats] = useState({ pending: 0, suspended: 0, approved: 0 });

  // "Add merchant" sheet for admin manual onboarding (`status='approved'` so the
  // merchant can sign in and start listing immediately). Fields mirror the minimum
  // required by `MerchantOnboarding` step 1.
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addBusiness, setAddBusiness] = useState('');
  const [addLegal, setAddLegal] = useState('');
  const [addContactName, setAddContactName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addOutletName, setAddOutletName] = useState('');
  const [addOutletAddress, setAddOutletAddress] = useState('');
  const [addOutletCategory, setAddOutletCategory] = useState<
    'bakery' | 'cafe' | 'restaurant' | 'supermarket' | 'hotel' | 'other'
  >('other');
  const [addOpensAt, setAddOpensAt] = useState('09:00');
  const [addClosesAt, setAddClosesAt] = useState('18:00');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const ADD_OUTLET_CATEGORIES = [
    { key: 'bakery', label: 'Bakery' },
    { key: 'cafe', label: 'Cafe' },
    { key: 'restaurant', label: 'Restaurant' },
    { key: 'supermarket', label: 'Supermarket' },
    { key: 'hotel', label: 'Hotel' },
    { key: 'other', label: 'Other' },
  ] as const;

  function resetAddForm() {
    setAddStep(1);
    setAddBusiness('');
    setAddLegal('');
    setAddContactName('');
    setAddEmail('');
    setAddPhone('');
    setAddOutletName('');
    setAddOutletAddress('');
    setAddOutletCategory('other');
    setAddOpensAt('09:00');
    setAddClosesAt('18:00');
    setAddErr(null);
  }

  function goAddStep2() {
    const name = addBusiness.trim();
    const email = addEmail.trim();
    if (!name) {
      setAddErr('Business name is required.');
      return;
    }
    if (!email) {
      setAddErr('Contact email is required.');
      return;
    }
    setAddErr(null);
    setAddStep(2);
  }

  async function submitAddMerchant() {
    const name = addBusiness.trim();
    const email = addEmail.trim();
    const outletName = addOutletName.trim();
    if (!name || !email) {
      setAddErr('Complete step 1 before submitting.');
      setAddStep(1);
      return;
    }
    if (!outletName) {
      setAddErr('Outlet name is required.');
      return;
    }
    setAddSubmitting(true);
    setAddErr(null);
    const sb = getSupabase(env);
    const { data: merchantRow, error: insErr } = await sb
      .from('merchants')
      .insert({
        business_name: name,
        legal_name: addLegal.trim() || name,
        contact_name: addContactName.trim() || null,
        contact_email: email,
        contact_phone: addPhone.trim() || null,
        status: 'approved',
        payout_method: 'bank',
      })
      .select('id')
      .single();

    if (insErr || !merchantRow?.id) {
      setAddSubmitting(false);
      setAddErr(insErr?.message ?? 'Merchant insert did not return an id.');
      return;
    }

    const dayHours = { open: addOpensAt.trim() || '09:00', close: addClosesAt.trim() || '18:00' };
    const businessHours = {
      mon: dayHours,
      tue: dayHours,
      wed: dayHours,
      thu: dayHours,
      fri: dayHours,
      sat: dayHours,
      sun: dayHours,
    };

    const geoQuery = addOutletAddress.trim() || outletName;
    let outletLat: number = FALLBACK_COORDS.lat;
    let outletLng: number = FALLBACK_COORDS.lng;
    try {
      const { results } = await fetchLocationSearch(env, geoQuery);
      const hit = results[0];
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
        outletLat = hit.lat;
        outletLng = hit.lng;
      }
    } catch {
      // keep Colombo Fort fallback
    }
    const locationWkt = `SRID=4326;POINT(${outletLng} ${outletLat})`;

    const { error: outletErr } = await sb.from('outlets').insert({
      merchant_id: String(merchantRow.id),
      name: outletName,
      address: addOutletAddress.trim() || 'Address pending — update from outlet profile',
      category: addOutletCategory,
      business_hours: businessHours,
      is_active: true,
      location: locationWkt,
    });

    setAddSubmitting(false);
    if (outletErr) {
      setAddErr(
        `Merchant created, but outlet failed: ${outletErr.message}. Add the outlet from merchant profile.`,
      );
      setReloadKey((k) => k + 1);
      return;
    }

    resetAddForm();
    setAddOpen(false);
    setReloadKey((k) => k + 1);
    Alert.alert(
      'Merchant added',
      `${name} (${outletName}) is approved with a live outlet. Send a sign-in link to ${email}.`,
    );
  }

  // Reset to first page when filters/query change so the user doesn't get stranded on an
  // out-of-range page after narrowing results.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, query]);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const from = (page - 1) * ADMIN_MERCHANTS_PAGE_SIZE;
      const to = from + ADMIN_MERCHANTS_PAGE_SIZE - 1;
      let req = sb
        .from('merchants')
        .select(
          `
          id,
          business_name,
          status,
          created_at,
          contact_email,
          contact_phone
        `,
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to);
      if (statusFilter !== 'all') {
        req = req.eq('status', statusFilter);
      }
      const trimmed = query.trim();
      if (trimmed) {
        const escaped = trimmed.replace(/[%,]/g, '');
        req = req.or(
          `business_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%,contact_phone.ilike.%${escaped}%`,
        );
      }

      const { data, error, count } = await req;

      const counts: Record<string, number> = {};
      if (!error && (data ?? []).length > 0) {
        const ids = (data as Record<string, unknown>[]).map((r) => String(r.id ?? ''));
        const { data: rescueRows, error: rescueErr } = await sb.rpc('merchant_rescue_counts', {
          p_merchant_ids: ids,
        });
        if (!rescueErr) {
          ((rescueRows ?? []) as { merchant_id: string; rescue_count: number }[]).forEach((row) => {
            counts[String(row.merchant_id)] = Number(row.rescue_count ?? 0);
          });
        }
      }

      if (!m) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setErr(null);
        const mapped: MerchantRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
          const id = String(r.id ?? '');
          return {
            id,
            business_name: String(r.business_name ?? '') || 'Merchant',
            status: String(r.status ?? 'pending'),
            created_at: typeof r.created_at === 'string' ? r.created_at : null,
            contact_email: String(r.contact_email ?? ''),
            contact_phone: String(r.contact_phone ?? ''),
            rescues: counts[id] ?? 0,
          };
        });
        setRows(mapped);
        if (typeof count === 'number') setTotalCount(count);
        const pageStatsNext = mapped.reduce(
          (acc, r) => {
            const s = r.status.toLowerCase();
            if (s === 'pending') acc.pending += 1;
            else if (s === 'suspended') acc.suspended += 1;
            else if (s === 'approved' || s === 'active' || s === 'live') acc.approved += 1;
            return acc;
          },
          { pending: 0, suspended: 0, approved: 0 },
        );
        setPageStats(pageStatsNext);
      }
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok, reloadKey, page, statusFilter, query]);

  const updateMerchantStatus = useCallback(
    async (id: string, nextStatus: 'approved' | 'suspended' | 'rejected') => {
      setBusyId(id);
      const sb = getSupabase(env);
      const { error } = await sb
        .from('merchants')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      setBusyId(null);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [env],
  );

  const openRowActions = useCallback(
    (row: MerchantRow) => {
      const s = row.status.toLowerCase();
      const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
        { text: 'Close', style: 'cancel' },
      ];
      if (s !== 'suspended') {
        buttons.unshift({
          text: 'Suspend merchant',
          style: 'destructive',
          onPress: () => void updateMerchantStatus(row.id, 'suspended'),
        });
      } else {
        buttons.unshift({
          text: 'Reactivate (approve)',
          onPress: () => void updateMerchantStatus(row.id, 'approved'),
        });
      }
      if (s === 'pending') {
        buttons.unshift({
          text: 'Approve merchant',
          onPress: () => void updateMerchantStatus(row.id, 'approved'),
        });
      }
      Alert.alert(
        row.business_name,
        `${row.contact_email || row.contact_phone || row.id.slice(0, 8)}\nStatus: ${row.status} · ${row.rescues.toLocaleString()} rescues`,
        buttons,
      );
    },
    [updateMerchantStatus],
  );

  // Server-side filter via `.eq('status', ...)` + `.or(business_name.ilike, ...)`. Local rows
  // already match the active filter; no extra client-side filtering needed.
  const visible = rows;

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, paddingBottom: scrollBottomPad } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing.md,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <StitchText variant="h1" colorKey="text">
            Merchants
          </StitchText>
          <StitchText variant="body-md" colorKey="textMuted">
            Manage and monitor platform partners.
          </StitchText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            resetAddForm();
            setAddOpen(true);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <StitchIcon name="add" size={18} colorKey="onPrimary" />
          <StitchText variant="label" colorKey="onPrimary">
            Add merchant
          </StitchText>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {([
          ['all', 'All'],
          ['pending', 'Pending Approval'],
          ['suspended', 'Suspended'],
        ] as const).map(([key, label]) => {
          const on = statusFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setStatusFilter(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: radii.full,
                backgroundColor: on ? colors.primaryContainer : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.primaryContainer : colors.outlineVariant,
              }}
            >
              <StitchText variant="label" colorKey={on ? 'onPrimary' : 'textMuted'}>
                {label}
              </StitchText>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radii.default,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
        }}
      >
        <StitchIcon name="search" size={18} colorKey="textMuted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchants..."
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, minHeight: 40 }}
        />
      </View>

      {err ? <PolicyHint message={err} /> : null}

      {(() => {
        const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_MERCHANTS_PAGE_SIZE));
        const rangeStart = totalCount === 0 ? 0 : (page - 1) * ADMIN_MERCHANTS_PAGE_SIZE + 1;
        const rangeEnd = Math.min(totalCount, page * ADMIN_MERCHANTS_PAGE_SIZE);
        return (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StitchSurface elevated padding="md" style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="textMuted">Total</StitchText>
                <StitchText variant="display" colorKey="text">{totalCount.toLocaleString()}</StitchText>
              </StitchSurface>
              <StitchSurface elevated padding="md" style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="textMuted">Page pending</StitchText>
                <StitchText variant="display" colorKey={pageStats.pending > 0 ? 'accent' : 'text'}>
                  {pageStats.pending.toLocaleString()}
                </StitchText>
              </StitchSurface>
              <StitchSurface elevated padding="md" style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="textMuted">Page suspended</StitchText>
                <StitchText variant="display" colorKey={pageStats.suspended > 0 ? 'error' : 'text'}>
                  {pageStats.suspended.toLocaleString()}
                </StitchText>
              </StitchSurface>
            </View>

            <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <StitchText variant="h3" colorKey="text">Recent merchants</StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()}
                </StitchText>
              </View>
              {loading ? (
                <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primaryContainer} />
              ) : visible.length === 0 ? (
                <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: spacing.md }}>
                  No merchants match this filter (or blocked by RLS).
                </StitchText>
              ) : (
                visible.map((item, idx) => {
                  const pill = statusPillTokens(item.status, colors);
                  const initial = item.business_name.trim()[0]?.toUpperCase() ?? 'M';
                  const isBusy = busyId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => navigation.navigate('AdminMerchantDetail', { merchantId: item.id })}
                      onLongPress={() => openRowActions(item)}
                      disabled={isBusy}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: spacing.md,
                        borderBottomWidth: idx === visible.length - 1 ? 0 : 1,
                        borderBottomColor: colors.divider,
                        gap: spacing.md,
                        opacity: isBusy ? 0.5 : pressed ? 0.8 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radii.default,
                          backgroundColor: colors.surfaceContainer,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <StitchText variant="label" colorKey="primary">{initial}</StitchText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <StitchText variant="h3" colorKey="text" numberOfLines={1}>
                          {item.business_name}
                        </StitchText>
                        <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1}>
                          {item.contact_email || item.contact_phone || item.id.slice(0, 8)}
                        </StitchText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: radii.full,
                            backgroundColor: pill.bg,
                          }}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: pill.dot,
                            }}
                          />
                          <StitchText variant="label-caps" colorKey="text" style={{ color: pill.fg }}>
                            {item.status}
                          </StitchText>
                        </View>
                        <StitchText variant="body-sm" colorKey="textMuted">
                          {item.rescues.toLocaleString()} rescues
                        </StitchText>
                      </View>
                    </Pressable>
                  );
                })
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: spacing.md,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                }}
              >
                <Pressable
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radii.default,
                    borderWidth: 1,
                    borderColor: colors.outlineVariant,
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  <StitchIcon name="chevron_left" size={16} colorKey="textMuted" />
                  <StitchText variant="label" colorKey="textMuted">Previous</StitchText>
                </Pressable>
                <StitchText variant="body-sm" colorKey="textMuted">
                  Page {page} of {totalPages}
                </StitchText>
                <Pressable
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radii.default,
                    borderWidth: 1,
                    borderColor: colors.outlineVariant,
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  <StitchText variant="label" colorKey="textMuted">Next</StitchText>
                  <StitchIcon name="chevron_right" size={16} colorKey="textMuted" />
                </Pressable>
              </View>
            </StitchSurface>
            <StitchText variant="body-sm" colorKey="textMuted">
              Tap a row to open the merchant detail. Long-press for quick status actions.
            </StitchText>
          </>
        );
      })()}

      <Modal
        transparent
        visible={addOpen}
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setAddOpen(false)}
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
              gap: spacing.md,
            }}
          >
            <StitchText variant="h2" colorKey="text">
              Add merchant
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Step {addStep} of 2 · Approved merchant + first outlet.
            </StitchText>

            {addStep === 1 ? (
              <>
                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Business name *
                  </StitchText>
                  <TextInput
                    value={addBusiness}
                    onChangeText={setAddBusiness}
                    placeholder="Stitch Bakery Co."
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Legal name
                  </StitchText>
                  <TextInput
                    value={addLegal}
                    onChangeText={setAddLegal}
                    placeholder="Stitch Bakery (Pvt) Ltd."
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Contact name
                  </StitchText>
                  <TextInput
                    value={addContactName}
                    onChangeText={setAddContactName}
                    placeholder="Anjali Perera"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <StitchText variant="label-caps" colorKey="textMuted">
                      Email *
                    </StitchText>
                    <TextInput
                      value={addEmail}
                      onChangeText={setAddEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="hello@stitchbakery.lk"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.outlineVariant,
                        borderRadius: radii.default,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.text,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <StitchText variant="label-caps" colorKey="textMuted">
                      Phone
                    </StitchText>
                    <TextInput
                      value={addPhone}
                      onChangeText={setAddPhone}
                      keyboardType="phone-pad"
                      placeholder="+94 77 123 4567"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.outlineVariant,
                        borderRadius: radii.default,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.text,
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Outlet name *
                  </StitchText>
                  <TextInput
                    value={addOutletName}
                    onChangeText={setAddOutletName}
                    placeholder="Colombo Fort branch"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Address
                  </StitchText>
                  <TextInput
                    value={addOutletAddress}
                    onChangeText={setAddOutletAddress}
                    placeholder="42 Galle Road, Colombo 03"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.outlineVariant,
                      borderRadius: radii.default,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      color: colors.text,
                    }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <StitchText variant="label-caps" colorKey="textMuted">
                    Category
                  </StitchText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {ADD_OUTLET_CATEGORIES.map((cat) => {
                      const on = addOutletCategory === cat.key;
                      return (
                        <Pressable
                          key={cat.key}
                          onPress={() => setAddOutletCategory(cat.key)}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: 8,
                            borderRadius: radii.full,
                            backgroundColor: on ? colors.primaryContainer : colors.surface,
                            borderWidth: 1,
                            borderColor: on ? colors.primaryContainer : colors.outlineVariant,
                          }}
                        >
                          <StitchText variant="label" colorKey={on ? 'onPrimary' : 'textMuted'}>
                            {cat.label}
                          </StitchText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <StitchText variant="label-caps" colorKey="textMuted">
                      Opens
                    </StitchText>
                    <TextInput
                      value={addOpensAt}
                      onChangeText={setAddOpensAt}
                      placeholder="09:00"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.outlineVariant,
                        borderRadius: radii.default,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.text,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <StitchText variant="label-caps" colorKey="textMuted">
                      Closes
                    </StitchText>
                    <TextInput
                      value={addClosesAt}
                      onChangeText={setAddClosesAt}
                      placeholder="18:00"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.outlineVariant,
                        borderRadius: radii.default,
                        paddingHorizontal: spacing.md,
                        paddingVertical: 10,
                        color: colors.text,
                      }}
                    />
                  </View>
                </View>
              </>
            )}

            {addErr ? (
              <StitchText variant="body-sm" colorKey="error">
                {addErr}
              </StitchText>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {addStep === 2 ? (
                <StitchButton
                  title="Back"
                  variant="secondary"
                  disabled={addSubmitting}
                  onPress={() => {
                    setAddStep(1);
                    setAddErr(null);
                  }}
                  style={{ flex: 1 }}
                />
              ) : (
                <StitchButton
                  title="Cancel"
                  variant="secondary"
                  disabled={addSubmitting}
                  onPress={() => setAddOpen(false)}
                  style={{ flex: 1 }}
                />
              )}
              <StitchButton
                title={
                  addSubmitting
                    ? 'Adding…'
                    : addStep === 1
                      ? 'Next: outlet'
                      : 'Add merchant'
                }
                variant="primary"
                disabled={addSubmitting}
                onPress={() => {
                  if (addStep === 1) goAddStep2();
                  else void submitAddMerchant();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </StitchScreen>
  );
}

// ---------------------------------------------------------------------------
// AdminMerchantDetailScreen
// ---------------------------------------------------------------------------

type MerchantDetail = {
  id: string;
  business_name: string;
  legal_name: string;
  status: string;
  created_at: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  business_registration_number: string;
  business_proof_url: string;
  outlet_photos: string[];
  bank_details: Record<string, unknown> | null;
  payout_method: string;
  admin_notes: string;
  rejection_reason: string;
};

type MerchantRecentOrder = {
  id: string;
  outlet_id: string;
  outlet_name: string;
  order_status: string;
  total: number;
  created_at: string | null;
};

type MerchantAuditEvent = {
  id: string;
  action: string;
  created_at: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown> | null;
};

export function AdminMerchantDetailScreen(): React.ReactElement {
  const navigation = useNavigation<AdminNav>();
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminMerchantDetail'>>();
  const merchantId = route.params?.merchantId ?? '';
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();

  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [recentOrders, setRecentOrders] = useState<MerchantRecentOrder[]>([]);
  const [openComplaints, setOpenComplaints] = useState<number>(0);
  const [auditEvents, setAuditEvents] = useState<MerchantAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ok || !merchantId) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const [merchantRes, outletsRes, complaintsRes, auditRes] = await Promise.all([
        sb
          .from('merchants')
          .select(
            `id, business_name, legal_name, status, created_at, contact_name, contact_email, contact_phone, business_registration_number, business_proof_url, outlet_photos, bank_details, payout_method, admin_notes, rejection_reason`,
          )
          .eq('id', merchantId)
          .maybeSingle(),
        // Pull the merchant's outlets so we can resolve outlet names + recent orders without
        // requiring an embedded join (RLS-friendly).
        sb
          .from('outlets')
          .select('id, name, merchant_id')
          .eq('merchant_id', merchantId)
          .limit(50),
        sb
          .from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .not('status', 'in', '("resolved","closed","dismissed")'),
        sb
          .from('audit_logs')
          .select('id, action, created_at, actor_role, metadata')
          .eq('subject_type', 'merchant')
          .eq('subject_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (!m) return;

      if (merchantRes.error) {
        setErr(merchantRes.error.message);
        setDetail(null);
      } else if (merchantRes.data) {
        const r = merchantRes.data as Record<string, unknown>;
        setErr(null);
        setDetail({
          id: String(r.id ?? ''),
          business_name: String(r.business_name ?? '') || 'Merchant',
          legal_name: String(r.legal_name ?? ''),
          status: String(r.status ?? 'pending'),
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          contact_name: String(r.contact_name ?? ''),
          contact_email: String(r.contact_email ?? ''),
          contact_phone: String(r.contact_phone ?? ''),
          business_registration_number: String(r.business_registration_number ?? ''),
          business_proof_url: String(r.business_proof_url ?? ''),
          outlet_photos: Array.isArray(r.outlet_photos)
            ? (r.outlet_photos as unknown[]).map((p) => String(p))
            : [],
          bank_details:
            r.bank_details && typeof r.bank_details === 'object'
              ? (r.bank_details as Record<string, unknown>)
              : null,
          payout_method: String(r.payout_method ?? ''),
          admin_notes: String(r.admin_notes ?? ''),
          rejection_reason: String(r.rejection_reason ?? ''),
        });
      } else {
        setDetail(null);
      }

      const outletRows = ((outletsRes.data ?? []) as Record<string, unknown>[]).map((o) => ({
        id: String(o.id ?? ''),
        name: String(o.name ?? '') || 'Outlet',
      }));
      const outletIds = outletRows.map((o) => o.id).filter(Boolean);
      const outletNameById: Record<string, string> = {};
      outletRows.forEach((o) => {
        outletNameById[o.id] = o.name;
      });

      if (outletIds.length > 0) {
        const { data: orderRows } = await sb
          .from('orders')
          .select('id, outlet_id, order_status, total, created_at')
          .in('outlet_id', outletIds)
          .order('created_at', { ascending: false })
          .limit(10);
        const mappedOrders: MerchantRecentOrder[] = ((orderRows ?? []) as Record<string, unknown>[]).map((o) => {
          const outletId = String(o.outlet_id ?? '');
          return {
            id: String(o.id ?? ''),
            outlet_id: outletId,
            outlet_name: outletNameById[outletId] || outletId.slice(0, 8),
            order_status: String(o.order_status ?? '—'),
            total: Number(o.total ?? 0),
            created_at: typeof o.created_at === 'string' ? o.created_at : null,
          };
        });
        if (m) setRecentOrders(mappedOrders);
      } else if (m) {
        setRecentOrders([]);
      }

      if (m) setOpenComplaints(complaintsRes.count ?? 0);

      const mappedAudit: MerchantAuditEvent[] = ((auditRes.data ?? []) as Record<string, unknown>[]).map((a) => ({
        id: String(a.id ?? ''),
        action: String(a.action ?? ''),
        created_at: typeof a.created_at === 'string' ? a.created_at : null,
        actor_role: typeof a.actor_role === 'string' ? a.actor_role : null,
        metadata:
          a.metadata && typeof a.metadata === 'object'
            ? (a.metadata as Record<string, unknown>)
            : null,
      }));
      if (m) setAuditEvents(mappedAudit);

      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, merchantId, ok, reloadKey]);

  const updateStatus = useCallback(
    async (next: 'approved' | 'suspended' | 'rejected') => {
      if (!detail) return;
      setBusy(true);
      const sb = getSupabase(env);
      const { error } = await sb
        .from('merchants')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', detail.id);
      setBusy(false);
      if (error) {
        Alert.alert('Status change failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [detail, env],
  );

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, paddingBottom: scrollBottomPad } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }

  if (!detail) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
        <StitchText variant="h1" colorKey="text">Merchant not found</StitchText>
        {err ? <PolicyHint message={err} /> : (
          <StitchText variant="body-md" colorKey="textMuted">
            We couldn't load this merchant (it may have been deleted, or RLS is blocking the read).
          </StitchText>
        )}
        <StitchButton title="Back to merchants" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  const pill = statusPillTokens(detail.status, colors);
  const s = detail.status.toLowerCase();
  const submitted = detail.created_at
    ? new Date(detail.created_at).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
    : '—';

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: {
          padding: spacing.pageMarginMobile,
          gap: spacing.md,
          paddingBottom: scrollBottomPad,
        },
      }}
    >
      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.default,
              backgroundColor: colors.surfaceContainer,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <StitchText variant="h2" colorKey="primary">
              {detail.business_name.trim()[0]?.toUpperCase() ?? 'M'}
            </StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="h1" colorKey="text" numberOfLines={2}>
              {detail.business_name}
            </StitchText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: pill.bg,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: pill.dot }} />
                <StitchText variant="label-caps" colorKey="text" style={{ color: pill.fg }}>
                  {detail.status}
                </StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted">
                Submitted {submitted}
              </StitchText>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
          {s !== 'approved' ? (
            <StitchButton
              title={busy ? 'Working…' : 'Approve'}
              variant="primary"
              disabled={busy}
              onPress={() => void updateStatus('approved')}
              style={{ flex: 1, minWidth: 120 }}
            />
          ) : null}
          {s !== 'suspended' ? (
            <StitchButton
              title={busy ? 'Working…' : 'Suspend'}
              variant="secondary"
              disabled={busy}
              onPress={() => void updateStatus('suspended')}
              style={{ flex: 1, minWidth: 120 }}
            />
          ) : (
            <StitchButton
              title={busy ? 'Working…' : 'Reactivate'}
              variant="secondary"
              disabled={busy}
              onPress={() => void updateStatus('approved')}
              style={{ flex: 1, minWidth: 120 }}
            />
          )}
          {s === 'pending' ? (
            <StitchButton
              title={busy ? 'Working…' : 'Reject'}
              variant="secondary"
              disabled={busy}
              onPress={() => void updateStatus('rejected')}
              style={{ flex: 1, minWidth: 120 }}
            />
          ) : null}
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StitchIcon name="badge" size={18} colorKey="primary" />
          <StitchText variant="h3" colorKey="text">Identity</StitchText>
        </View>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <View>
            <StitchText variant="body-sm" colorKey="textMuted">Legal entity</StitchText>
            <StitchText variant="body-md" colorKey="text">
              {detail.legal_name || detail.business_name}
            </StitchText>
          </View>
          <View>
            <StitchText variant="body-sm" colorKey="textMuted">Registration #</StitchText>
            <StitchText variant="body-md" colorKey="text">
              {detail.business_registration_number || '—'}
            </StitchText>
          </View>
          <View>
            <StitchText variant="body-sm" colorKey="textMuted">Primary contact</StitchText>
            <StitchText variant="body-md" colorKey="text">
              {detail.contact_name || '—'}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              {[detail.contact_email, detail.contact_phone].filter(Boolean).join(' · ') || '—'}
            </StitchText>
          </View>
        </View>
      </StitchSurface>

      {detail.bank_details ? (
        <StitchSurface elevated padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StitchIcon name="account_balance" size={18} colorKey="primary" />
            <StitchText variant="h3" colorKey="text">Bank & payout</StitchText>
          </View>
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {([
              ['bank_name', 'Bank'],
              ['account_holder', 'Account holder'],
              ['account_name', 'Account name'],
              ['account_number', 'Account number'],
              ['branch', 'Branch'],
              ['branch_code', 'Branch code'],
            ] as const).map(([key, label]) => {
              const raw = detail.bank_details?.[key];
              if (raw == null || String(raw).trim() === '') return null;
              return (
                <View key={key}>
                  <StitchText variant="body-sm" colorKey="textMuted">{label}</StitchText>
                  <StitchText variant="body-md" colorKey="text">{String(raw)}</StitchText>
                </View>
              );
            })}
            {detail.payout_method ? (
              <View>
                <StitchText variant="body-sm" colorKey="textMuted">Payout method</StitchText>
                <StitchText variant="body-md" colorKey="text">{detail.payout_method}</StitchText>
              </View>
            ) : null}
          </View>
        </StitchSurface>
      ) : null}

      {detail.outlet_photos.length > 0 ? (
        <StitchSurface elevated padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StitchIcon name="photo_camera" size={18} colorKey="primary" />
            <StitchText variant="h3" colorKey="text">
              Outlet photos ({detail.outlet_photos.length})
            </StitchText>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <OutletPhotoGrid urls={detail.outlet_photos} columns={3} />
          </View>
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StitchIcon name="receipt_long" size={18} colorKey="primary" />
            <StitchText variant="h3" colorKey="text">Recent orders</StitchText>
          </View>
          <Pressable
            onPress={() => navigateToAdminPlatformOrders(navigation as unknown as AdminCrossTabNavigation)}
          >
            <StitchText variant="label" colorKey="primary">All orders</StitchText>
          </Pressable>
        </View>
        {recentOrders.length === 0 ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            No orders across this merchant's outlets yet.
          </StitchText>
        ) : (
          recentOrders.map((o, idx) => {
            const opill = statusPillTokens(o.order_status, colors);
            const ts = o.created_at
              ? new Date(o.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';
            return (
              <Pressable
                key={o.id}
                onPress={() => navigation.navigate('AdminPlatformOrderDetail', { orderId: o.id })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderBottomWidth: idx === recentOrders.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <StitchText variant="body-md" colorKey="text" numberOfLines={1}>
                    {o.outlet_name}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1}>
                    {ts} · LKR {o.total.toLocaleString()}
                  </StitchText>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: radii.full,
                    backgroundColor: opill.bg,
                  }}
                >
                  <StitchText variant="label-caps" colorKey="text" style={{ color: opill.fg }}>
                    {o.order_status}
                  </StitchText>
                </View>
              </Pressable>
            );
          })
        )}
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StitchIcon name="flag" size={18} colorKey="primary" />
            <StitchText variant="h3" colorKey="text">Open complaints</StitchText>
          </View>
          <Pressable onPress={() => navigateToAdminComplaints(navigation as unknown as AdminCrossTabNavigation)}>
            <StitchText variant="label" colorKey="primary">View all</StitchText>
          </Pressable>
        </View>
        <StitchText
          variant="display"
          colorKey={openComplaints > 0 ? 'error' : 'text'}
          style={{ marginTop: spacing.sm }}
        >
          {openComplaints.toLocaleString()}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted">
          Complaints filed against this merchant that aren't yet resolved.
        </StitchText>
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StitchIcon name="history" size={18} colorKey="primary" />
          <StitchText variant="h3" colorKey="text">Audit trail</StitchText>
        </View>
        {auditEvents.length === 0 ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            No audit events recorded for this merchant yet.
          </StitchText>
        ) : (
          auditEvents.map((evt, idx) => {
            const ts = evt.created_at
              ? new Date(evt.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';
            const metaPreview =
              evt.metadata && typeof evt.metadata === 'object'
                ? Object.entries(evt.metadata)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                    .join(' · ')
                : '';
            return (
              <View
                key={evt.id}
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: idx === auditEvents.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <StitchText variant="body-md" colorKey="text" numberOfLines={1} style={{ flex: 1 }}>
                    {evt.action || 'event'}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">{ts}</StitchText>
                </View>
                {evt.actor_role || metaPreview ? (
                  <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={2}>
                    {[evt.actor_role, metaPreview].filter(Boolean).join(' · ')}
                  </StitchText>
                ) : null}
              </View>
            );
          })
        )}
      </StitchSurface>

      {detail.admin_notes ? (
        <StitchSurface elevated padding="md">
          <StitchText variant="label-caps" colorKey="textMuted">Admin notes</StitchText>
          <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 4 }}>
            {detail.admin_notes}
          </StitchText>
        </StitchSurface>
      ) : null}
    </StitchScreen>
  );
}

type ApplicationRow = {
  id: string;
  business_name: string;
  legal_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  business_registration_number: string;
  business_proof_url: string;
  created_at: string | null;
  status: string;
  rejection_reason: string;
  admin_notes: string;
  bank_details: Record<string, unknown> | null;
  payout_method: string;
  outlet_photos: string[];
};

export function AdminApplicationReviewScreen() {
  const navigation = useNavigation<AdminNav>();
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ id: string; text: string } | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = getSupabase(env);
    const { data, error } = await sb
      .from('merchants')
      .select(
        `
        id,
        business_name,
        legal_name,
        contact_name,
        contact_email,
        contact_phone,
        business_registration_number,
        business_proof_url,
        created_at,
        status,
        rejection_reason,
        admin_notes,
        bank_details,
        payout_method,
        outlet_photos
      `,
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setErr(null);
      const mapped: ApplicationRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ''),
        business_name: String(r.business_name ?? '') || 'Application',
        legal_name: String(r.legal_name ?? ''),
        contact_name: String(r.contact_name ?? ''),
        contact_email: String(r.contact_email ?? ''),
        contact_phone: String(r.contact_phone ?? ''),
        business_registration_number: String(r.business_registration_number ?? ''),
        business_proof_url: String(r.business_proof_url ?? ''),
        created_at: typeof r.created_at === 'string' ? r.created_at : null,
        status: String(r.status ?? 'pending'),
        rejection_reason: String(r.rejection_reason ?? ''),
        admin_notes: String(r.admin_notes ?? ''),
        bank_details:
          r.bank_details && typeof r.bank_details === 'object'
            ? (r.bank_details as Record<string, unknown>)
            : null,
        payout_method: String(r.payout_method ?? ''),
        outlet_photos: Array.isArray(r.outlet_photos)
          ? (r.outlet_photos as unknown[]).map((p) => String(p))
          : [],
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [env]);

  useEffect(() => {
    if (!ok) return;
    void load();
  }, [load, ok]);

  const approve = useCallback(
    async (row: ApplicationRow) => {
      setBusyId(row.id);
      const sb = getSupabase(env);
      const { error } = await sb
        .from('merchants')
        .update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      setBusyId(null);
      if (error) {
        setErr(error.message);
        return;
      }
      void load();
    },
    [env, load],
  );

  const reject = useCallback(
    async (row: ApplicationRow) => {
      setBusyId(row.id);
      const sb = getSupabase(env);
      const { error } = await sb
        .from('merchants')
        .update({
          status: 'rejected',
          rejection_reason: 'Rejected in admin review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      setBusyId(null);
      if (error) {
        setErr(error.message);
        return;
      }
      void load();
    },
    [env, load],
  );

  const requestInfo = useCallback((row: ApplicationRow) => {
    setNoteDraft({ id: row.id, text: '' });
  }, []);

  const submitNoteDraft = useCallback(async () => {
    if (!noteDraft) return;
    const trimmed = noteDraft.text.trim();
    if (trimmed.length === 0) {
      Alert.alert('Empty note', 'Add at least one note line before requesting info.');
      return;
    }
    const row = rows.find((r) => r.id === noteDraft.id);
    if (!row) return;
    setBusyId(row.id);
    const sb = getSupabase(env);
    const stamp = new Date().toISOString();
    const prefix = row.admin_notes ? `${row.admin_notes}\n\n` : '';
    const next = `${prefix}[${stamp}] Info requested: ${trimmed}`;
    const { error } = await sb
      .from('merchants')
      .update({
        admin_notes: next,
        updated_at: stamp,
      })
      .eq('id', row.id);
    setBusyId(null);
    setNoteDraft(null);
    if (error) {
      Alert.alert('Request failed', error.message);
      return;
    }
    Alert.alert(
      'Info requested',
      'Note appended to merchant `admin_notes` (status remains pending).',
    );
    void load();
  }, [env, load, noteDraft, rows]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Application review</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Live queue of `merchants` with `status='pending'` awaiting approval.
      </StitchText>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />
      ) : err ? (
        <PolicyHint message={err} />
      ) : rows.length === 0 ? (
        <StitchSurface elevated padding="md">
          <StitchText variant="body-md" colorKey="textMuted">
            No pending applications. New submissions appear here automatically.
          </StitchText>
        </StitchSurface>
      ) : (
        rows.map((row) => {
          const submittedAt = row.created_at
            ? new Date(row.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })
            : '—';
          const isBusy = busyId === row.id;
          return (
            <StitchSurface key={row.id} elevated padding="md">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: colors.accentHighlight,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: colors.accent,
                  }}
                />
                <StitchText variant="label-caps" colorKey="text" style={{ color: colors.accent }}>
                  Pending review
                </StitchText>
              </View>

              <StitchText variant="h2" colorKey="text" style={{ marginTop: spacing.sm }}>
                {row.business_name}
              </StitchText>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <StitchIcon name="tag" size={16} colorKey="textMuted" />
                <StitchText variant="body-sm" colorKey="textMuted">
                  {row.id.slice(0, 8).toUpperCase()} · Submitted {submittedAt}
                </StitchText>
              </View>

              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <View>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Legal entity
                  </StitchText>
                  <StitchText variant="body-md" colorKey="text">
                    {row.legal_name || row.business_name}
                  </StitchText>
                </View>
                <View>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Registration #
                  </StitchText>
                  <StitchText variant="body-md" colorKey="text">
                    {row.business_registration_number || '—'}
                  </StitchText>
                </View>
                <View>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Primary contact
                  </StitchText>
                  <StitchText variant="body-md" colorKey="text">
                    {row.contact_name || '—'}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted">
                    {[row.contact_email, row.contact_phone].filter(Boolean).join(' · ') || '—'}
                  </StitchText>
                </View>
                {row.business_proof_url ? (
                  <StitchText variant="body-sm" colorKey="primary" numberOfLines={1}>
                    {row.business_proof_url}
                  </StitchText>
                ) : null}
              </View>

              {row.outlet_photos.length > 0 ? (
                <View
                  style={{
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: radii.default,
                    backgroundColor: colors.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StitchIcon name="photo_camera" size={18} colorKey="primary" />
                    <StitchText variant="h3" colorKey="text">
                      Outlet photos ({row.outlet_photos.length})
                    </StitchText>
                  </View>
                  <OutletPhotoGrid
                    urls={row.outlet_photos}
                    onTap={(url) => setPhotoViewerUrl(url)}
                  />
                  <StitchText variant="body-sm" colorKey="textMuted">
                    Tap a tile to view fullscreen.
                  </StitchText>
                </View>
              ) : null}

              {row.bank_details ? (
                <View
                  style={{
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: radii.default,
                    backgroundColor: colors.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StitchIcon name="account_balance" size={18} colorKey="primary" />
                    <StitchText variant="h3" colorKey="text">Bank information</StitchText>
                  </View>
                  {([
                    ['bank_name', 'Bank'],
                    ['account_holder', 'Account holder'],
                    ['account_name', 'Account name'],
                    ['account_number', 'Account number'],
                    ['branch', 'Branch'],
                    ['branch_code', 'Branch code'],
                  ] as const).map(([key, label]) => {
                    const raw = row.bank_details?.[key];
                    if (raw == null || String(raw).trim() === '') return null;
                    return (
                      <View key={key}>
                        <StitchText variant="body-sm" colorKey="textMuted">
                          {label}
                        </StitchText>
                        <StitchText variant="body-md" colorKey="text">
                          {String(raw)}
                        </StitchText>
                      </View>
                    );
                  })}
                  {row.payout_method ? (
                    <View>
                      <StitchText variant="body-sm" colorKey="textMuted">Payout method</StitchText>
                      <StitchText variant="body-md" colorKey="text">{row.payout_method}</StitchText>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {row.admin_notes ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: radii.default,
                    backgroundColor: colors.surfaceContainer,
                  }}
                >
                  <StitchText variant="label-caps" colorKey="textMuted">Admin notes</StitchText>
                  <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 2 }}>
                    {row.admin_notes}
                  </StitchText>
                </View>
              ) : null}
              {row.rejection_reason ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: radii.default,
                    backgroundColor: colors.errorContainer,
                  }}
                >
                  <StitchText variant="label-caps" colorKey="textMuted">Last rejection reason</StitchText>
                  <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 2 }}>
                    {row.rejection_reason}
                  </StitchText>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View full profile for ${row.business_name}`}
                onPress={() =>
                  navigation.navigate('AdminMerchantDetail', {
                    merchantId: row.id,
                  })
                }
                style={{
                  marginTop: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                }}
              >
                <StitchIcon
                  name="person"
                  size={16}
                  colorKey="primaryContainer"
                />
                <StitchText variant="label" colorKey="primaryContainer">
                  View full profile
                </StitchText>
                <StitchIcon
                  name="chevron_right"
                  size={16}
                  colorKey="primaryContainer"
                />
              </Pressable>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                <StitchButton
                  title={isBusy ? 'Approving…' : 'Approve'}
                  variant="primary"
                  disabled={isBusy}
                  onPress={() => {
                    void approve(row);
                  }}
                  style={{ flex: 1, minWidth: 120 }}
                />
                <StitchButton
                  title={isBusy ? 'Working…' : 'Request info'}
                  variant="secondary"
                  disabled={isBusy}
                  onPress={() => {
                    requestInfo(row);
                  }}
                  style={{ flex: 1, minWidth: 120 }}
                />
                <StitchButton
                  title={isBusy ? 'Working…' : 'Reject'}
                  variant="secondary"
                  disabled={isBusy}
                  onPress={() => {
                    void reject(row);
                  }}
                  style={{ flex: 1, minWidth: 120 }}
                />
              </View>
            </StitchSurface>
          );
        })
      )}

      <Modal
        transparent
        visible={noteDraft != null}
        animationType="fade"
        onRequestClose={() => setNoteDraft(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setNoteDraft(null)}
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
              gap: spacing.md,
            }}
          >
            <StitchText variant="h2" colorKey="text">
              Request more info
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted">
              Write a clear, free-form note. It will append to
              `merchants.admin_notes`. Merchant status stays pending until you
              approve or reject.
            </StitchText>
            <TextInput
              value={noteDraft?.text ?? ''}
              onChangeText={(t) =>
                setNoteDraft((d) => (d ? { ...d, text: t } : null))
              }
              placeholder="e.g. Please reupload a sharper photo of the business registration document and provide a utility bill at the trading address."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              style={{
                minHeight: 120,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.text,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <StitchButton
                title="Send request"
                variant="primary"
                disabled={busyId === noteDraft?.id}
                onPress={() => {
                  void submitNoteDraft();
                }}
                style={{ flex: 1 }}
              />
              <StitchButton
                title="Cancel"
                variant="secondary"
                onPress={() => setNoteDraft(null)}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={photoViewerUrl != null}
        animationType="fade"
        onRequestClose={() => setPhotoViewerUrl(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close fullscreen photo"
          onPress={() => setPhotoViewerUrl(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          {photoViewerUrl ? (
            <Image
              source={{ uri: photoViewerUrl }}
              resizeMode="contain"
              style={{ width: '100%', height: '85%' }}
              accessibilityLabel="Photo enlarged preview"
            />
          ) : null}
          <View
            style={{
              position: 'absolute',
              bottom: spacing.lg,
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radii.full,
            }}
          >
            <StitchText variant="body-sm" colorKey="onPrimary">
              Tap anywhere to close
            </StitchText>
          </View>
        </Pressable>
      </Modal>
    </StitchScreen>
  );
}

type PromoRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  source: string;
};

export function AdminPromosAdminScreen() {
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = getSupabase(env);
    const { data, error } = await sb
      .from('promo_codes')
      .select(
        `
        id,
        code,
        discount_type,
        discount_value,
        min_order_value,
        max_uses,
        used_count,
        valid_from,
        valid_until,
        is_active,
        source
      `,
      )
      .order('valid_until', { ascending: true, nullsFirst: false })
      .limit(60);
    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setErr(null);
      const mapped: PromoRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ''),
        code: String(r.code ?? ''),
        discount_type: String(r.discount_type ?? 'percent'),
        discount_value: Number(r.discount_value ?? 0),
        min_order_value: Number(r.min_order_value ?? 0),
        max_uses: typeof r.max_uses === 'number' ? (r.max_uses as number) : null,
        used_count: Number(r.used_count ?? 0),
        valid_from: typeof r.valid_from === 'string' ? (r.valid_from as string) : null,
        valid_until: typeof r.valid_until === 'string' ? (r.valid_until as string) : null,
        is_active: Boolean(r.is_active ?? false),
        source: String(r.source ?? ''),
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [env]);

  useEffect(() => {
    if (!ok) return;
    void load();
  }, [load, ok]);

  const togglePromo = useCallback(
    async (row: PromoRow) => {
      setBusyId(row.id);
      const sb = getSupabase(env);
      const { error } = await sb
        .from('promo_codes')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
      setBusyId(null);
      if (error) {
        setErr(error.message);
        return;
      }
      void load();
    },
    [env, load],
  );

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const totalUses = rows.reduce((sum, r) => sum + r.used_count, 0);
    const top = [...rows].sort((a, b) => b.used_count - a.used_count)[0];
    return {
      active,
      totalUses,
      topCode: top?.code ?? '—',
      topUses: top?.used_count ?? 0,
    };
  }, [rows]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <StitchText variant="h1" colorKey="text">Promo management</StitchText>
      <StitchText variant="body-md" colorKey="textMuted">
        Global promotions and budgets (admin context, `promo_codes`).
      </StitchText>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primaryContainer} />
      ) : err ? (
        <PolicyHint message={err} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <StitchSurface elevated padding="md" style={{ flex: 1, minWidth: 140 }}>
              <StitchText variant="label-caps" colorKey="textMuted">Active</StitchText>
              <StitchText variant="h2" colorKey="text">{summary.active}</StitchText>
            </StitchSurface>
            <StitchSurface elevated padding="md" style={{ flex: 1, minWidth: 140 }}>
              <StitchText variant="label-caps" colorKey="textMuted">Total uses</StitchText>
              <StitchText variant="h2" colorKey="text">{summary.totalUses}</StitchText>
            </StitchSurface>
            <StitchSurface elevated padding="md" style={{ flex: 1, minWidth: 140 }}>
              <StitchText variant="label-caps" colorKey="textMuted">Top performing</StitchText>
              <StitchText variant="h2" colorKey="text">{summary.topCode}</StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">{summary.topUses} uses</StitchText>
            </StitchSurface>
          </View>

          {rows.length === 0 ? (
            <StitchSurface elevated padding="md">
              <StitchText variant="body-md" colorKey="textMuted">
                No promo codes yet. Create one from the merchant or admin web console.
              </StitchText>
            </StitchSurface>
          ) : (
            rows.map((row) => {
              const isBusy = busyId === row.id;
              const isPercent = row.discount_type === 'percent';
              const discount = isPercent
                ? `${row.discount_value}% off`
                : `Rs. ${Math.round(row.discount_value).toLocaleString()} off`;
              const usageLine =
                row.max_uses != null
                  ? `${row.used_count}/${row.max_uses} uses`
                  : `${row.used_count} uses`;
              const validUntil = row.valid_until
                ? `Expires ${new Date(row.valid_until).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}`
                : 'No expiry';
              return (
                <StitchSurface key={row.id} elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <StitchText variant="h3" colorKey="text">{row.code}</StitchText>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: radii.full,
                        backgroundColor: row.is_active ? colors.primaryHighlight : colors.surfaceContainerHighest,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: row.is_active ? colors.primary : colors.textMuted,
                        }}
                      />
                      <StitchText
                        variant="label-caps"
                        colorKey="text"
                        style={{ color: row.is_active ? colors.primary : colors.textMuted }}
                      >
                        {row.is_active ? 'Active' : 'Paused'}
                      </StitchText>
                    </View>
                  </View>
                  <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
                    {discount}
                    {row.min_order_value > 0
                      ? ` · Min order Rs. ${Math.round(row.min_order_value).toLocaleString()}`
                      : ''}
                  </StitchText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                    <StitchText variant="body-sm" colorKey="textMuted">{usageLine}</StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">{validUntil}</StitchText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                    <StitchButton
                      title={row.is_active ? (isBusy ? 'Pausing…' : 'Pause promo') : (isBusy ? 'Resuming…' : 'Resume promo')}
                      variant="secondary"
                      disabled={isBusy}
                      onPress={() => {
                        void togglePromo(row);
                      }}
                      style={{ flex: 1 }}
                    />
                    <StitchButton
                      title="View on web"
                      variant="primary"
                      onPress={() => {
                        const url = `https://freshasever.com/discover?promo=${encodeURIComponent(
                          row.code,
                        )}`;
                        Linking.openURL(url).catch(() => {
                          Alert.alert(
                            'Could not open',
                            `Promo URL: ${url}`,
                          );
                        });
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </StitchSurface>
              );
            })
          )}
        </>
      )}
    </StitchScreen>
  );
}

type AdminOrderDetail = {
  id: string;
  reservation_code: string;
  order_status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  platform_fee: number;
  discount_amount: number;
  payment_method: string;
  created_at: string | null;
  reserved_at: string | null;
  collected_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  cancelled_by: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  outlet_name: string;
  outlet_address: string;
  merchant_name: string;
  bag_title: string;
  bag_image_url: string;
};

export function AdminPlatformOrderDetailScreen() {
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminPlatformOrderDetail'>>();
  const navigation = useNavigation<AdminNav>();
  const { env, user } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [auditTrail, setAuditTrail] = useState<
    { id: string; title: string; detail: string; actor: string; at: string | null; iconName: 'check_circle' | 'delete' | 'add_circle' | 'payments' | 'warning' }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const orderRes = await sb
        .from('orders')
        .select(
          `
          id,
          reservation_code,
          order_status,
          payment_status,
          total,
          subtotal,
          platform_fee,
          discount_amount,
          payment_method,
          created_at,
          reserved_at,
          collected_at,
          cancelled_at,
          cancellation_reason,
          cancelled_by,
          customer:profiles(full_name, phone),
          outlet:outlets(name, address, merchant:merchants(business_name, contact_email)),
          bag:rescue_bags(title, image_url)
        `,
        )
        .eq('id', route.params.orderId)
        .maybeSingle();

      const auditRes = await sb
        .from('audit_logs')
        .select('id, occurred_at, title, detail, actor_role, action')
        .eq('subject_type', 'order')
        .eq('subject_id', route.params.orderId)
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (!m) return;
      if (orderRes.error) {
        setErr(orderRes.error.message);
        setOrder(null);
      } else if (!orderRes.data) {
        setErr('Order not found (or blocked by RLS).');
        setOrder(null);
      } else {
        const r = orderRes.data as Record<string, unknown>;
        const customer = r.customer as Record<string, unknown> | undefined;
        const outlet = r.outlet as Record<string, unknown> | undefined;
        const merchant = outlet?.merchant as Record<string, unknown> | undefined;
        const bag = r.bag as Record<string, unknown> | undefined;
        setOrder({
          id: String(r.id ?? ''),
          reservation_code: String(r.reservation_code ?? ''),
          order_status: String(r.order_status ?? 'unknown'),
          payment_status: String(r.payment_status ?? 'unknown'),
          total: Number(r.total ?? 0),
          subtotal: Number(r.subtotal ?? 0),
          platform_fee: Number(r.platform_fee ?? 0),
          discount_amount: Number(r.discount_amount ?? 0),
          payment_method: String(r.payment_method ?? ''),
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          reserved_at: typeof r.reserved_at === 'string' ? r.reserved_at : null,
          collected_at: typeof r.collected_at === 'string' ? r.collected_at : null,
          cancelled_at: typeof r.cancelled_at === 'string' ? r.cancelled_at : null,
          cancellation_reason: String(r.cancellation_reason ?? ''),
          cancelled_by: String(r.cancelled_by ?? ''),
          customer_name: String(customer?.full_name ?? '') || 'Customer',
          customer_phone: String(customer?.phone ?? ''),
          customer_email: String(merchant?.contact_email ?? ''),
          outlet_name: String(outlet?.name ?? '') || 'Outlet',
          outlet_address: String(outlet?.address ?? ''),
          merchant_name: String(merchant?.business_name ?? '') || 'Merchant',
          bag_title: String(bag?.title ?? '') || 'Rescue bag',
          bag_image_url: String(bag?.image_url ?? ''),
        });
        setErr(null);
      }

      const auditMapped = ((auditRes.data ?? []) as Record<string, unknown>[]).map((a) => {
        const action = String(a.action ?? '');
        let iconName: 'check_circle' | 'delete' | 'add_circle' | 'payments' | 'warning' = 'add_circle';
        if (action === 'cancelled') iconName = 'delete';
        else if (action === 'collected' || action === 'approved' || action === 'resolved') iconName = 'check_circle';
        else if (action.includes('paid')) iconName = 'payments';
        return {
          id: String(a.id ?? ''),
          title: String(a.title ?? action),
          detail: String(a.detail ?? ''),
          actor: String(a.actor_role ?? 'system'),
          at: typeof a.occurred_at === 'string' ? (a.occurred_at as string) : null,
          iconName,
        };
      });
      setAuditTrail(auditMapped);
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok, route.params.orderId, reloadKey]);

  const performAction = useCallback(
    async (nextStatus: 'cancelled' | 'collected') => {
      if (!order) return;
      setBusy(true);
      if (nextStatus === 'collected') {
        const result = await adminCollectOrder(env, order.id);
        setBusy(false);
        if (!result.ok) {
          Alert.alert('Update failed', result.message);
          return;
        }
        setReloadKey((k) => k + 1);
        return;
      }
      const sb = getSupabase(env);
      const stamp = new Date().toISOString();
      const patch: Record<string, unknown> = {
        order_status: 'cancelled',
        updated_at: stamp,
        cancelled_at: stamp,
        cancelled_by: 'admin',
        cancellation_reason: `Admin override by ${user?.email ?? 'admin'}`,
      };
      const { error } = await sb.from('orders').update(patch).eq('id', order.id);
      setBusy(false);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [env, order, user?.email],
  );

  if (!ok) {
    return <AdminOnlyNotice />;
  }
  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, paddingBottom: scrollBottomPad } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }
  if (err || !order) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
        <PolicyHint message={err ?? 'Order not found'} />
        <StitchButton title="Back to orders" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  const status = order.order_status.toLowerCase();
  const canMutate = status !== 'collected' && status !== 'completed' && status !== 'cancelled';
  const ref = order.reservation_code || order.id.slice(0, 8).toUpperCase();
  const pill = statusPillTokens(order.order_status, colors);

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StitchText variant="h1" colorKey="text">Order #{ref}</StitchText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.full,
            backgroundColor: pill.bg,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: pill.dot }} />
          <StitchText variant="label-caps" colorKey="text" style={{ color: pill.fg }}>
            {order.order_status}
          </StitchText>
        </View>
      </View>
      <StitchText variant="body-md" colorKey="textMuted">
        Placed{' '}
        {order.created_at
          ? new Date(order.created_at).toLocaleString()
          : '—'}
      </StitchText>

      <StitchSurface elevated padding="md">
        {order.bag_image_url && /^https?:\/\//i.test(order.bag_image_url) ? (
          <View
            style={{
              width: '100%',
              aspectRatio: 16 / 9,
              borderRadius: radii.default,
              overflow: 'hidden',
              backgroundColor: colors.surfaceContainerLow,
              marginBottom: spacing.sm,
            }}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={`${order.bag_title ?? 'Bag'} preview`}
              source={{ uri: order.bag_image_url }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        ) : null}
        <StitchText variant="h3" colorKey="text">{order.bag_title}</StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
          {order.merchant_name} · {order.outlet_name}
        </StitchText>
        {order.outlet_address ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
            {order.outlet_address}
          </StitchText>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">Customer</StitchText>
        <StitchText variant="body-md" colorKey="text" style={{ marginTop: 4 }}>{order.customer_name}</StitchText>
        {order.customer_phone ? (
          <StitchText variant="body-sm" colorKey="textMuted">{order.customer_phone}</StitchText>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Payment</StitchText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <StitchText variant="body-sm" colorKey="textMuted">Subtotal</StitchText>
          <StitchText variant="body-sm" colorKey="text">
            Rs. {Math.round(order.subtotal).toLocaleString()}
          </StitchText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <StitchText variant="body-sm" colorKey="textMuted">Platform fee</StitchText>
          <StitchText variant="body-sm" colorKey="text">
            Rs. {Math.round(order.platform_fee).toLocaleString()}
          </StitchText>
        </View>
        {order.discount_amount > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <StitchText variant="body-sm" colorKey="textMuted">Discount</StitchText>
            <StitchText variant="body-sm" colorKey="accent">
              −Rs. {Math.round(order.discount_amount).toLocaleString()}
            </StitchText>
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <StitchText variant="label" colorKey="text">Total</StitchText>
          <StitchText variant="label" colorKey="text">
            Rs. {Math.round(order.total).toLocaleString()}
          </StitchText>
        </View>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 6 }}>
          {order.payment_method || 'unknown method'} · {order.payment_status}
        </StitchText>
      </StitchSurface>

      {order.cancellation_reason ? (
        <StitchSurface elevated padding="md" style={{ backgroundColor: colors.errorContainer }}>
          <StitchText variant="label-caps" colorKey="text">Cancellation</StitchText>
          <StitchText variant="body-sm" colorKey="text" style={{ marginTop: 4 }}>
            {order.cancellation_reason}
          </StitchText>
          {order.cancelled_by ? (
            <StitchText variant="body-sm" colorKey="textMuted">
              by {order.cancelled_by}
              {order.cancelled_at
                ? ` · ${new Date(order.cancelled_at).toLocaleString()}`
                : ''}
            </StitchText>
          ) : null}
        </StitchSurface>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StitchButton
          title={busy ? 'Working…' : 'Mark collected'}
          variant="primary"
          disabled={!canMutate || busy}
          onPress={() => void performAction('collected')}
          style={{ flex: 1 }}
        />
        <StitchButton
          title={busy ? 'Working…' : 'Cancel order'}
          variant="secondary"
          disabled={!canMutate || busy}
          onPress={() => void performAction('cancelled')}
          style={{ flex: 1 }}
        />
      </View>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Audit trail</StitchText>
        {auditTrail.length === 0 ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            No audit events recorded yet for this order.
          </StitchText>
        ) : (
          auditTrail.map((a, idx) => (
            <View
              key={a.id}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === auditTrail.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StitchIcon name={a.iconName} size={16} colorKey="textMuted" />
              </View>
              <View style={{ flex: 1 }}>
                <StitchText variant="label" colorKey="text">{a.title}</StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">{a.detail}</StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {a.actor} · {a.at ? new Date(a.at).toLocaleString() : '—'}
                </StitchText>
              </View>
            </View>
          ))
        )}
      </StitchSurface>
    </StitchScreen>
  );
}

type ComplaintDetail = {
  id: string;
  type: string;
  description: string;
  status: string;
  resolution: string;
  admin_notes: string;
  photos: string[];
  created_at: string | null;
  resolved_at: string | null;
  resolved_by: string;
  order_id: string;
  order_code: string;
  order_total: number;
  bag_title: string;
  outlet_name: string;
  merchant_name: string;
  reporter_name: string;
  reporter_phone: string;
};

export function AdminComplaintDetailScreen() {
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminComplaintDetail'>>();
  const navigation = useNavigation<AdminNav>();
  const { env, user } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [auditTrail, setAuditTrail] = useState<
    { id: string; title: string; detail: string; actor: string; at: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const [complaintRes, auditRes] = await Promise.all([
        sb
          .from('complaints')
          .select(
            `
            id,
            type,
            description,
            status,
            resolution,
            admin_notes,
            photos,
            created_at,
            resolved_at,
            resolved_by,
            order:orders(id, reservation_code, total, bag:rescue_bags(title), outlet:outlets(name, merchant:merchants(business_name))),
            reporter:profiles!complaints_reporter_id_fkey(full_name, phone)
          `,
          )
          .eq('id', route.params.complaintId)
          .maybeSingle(),
        sb
          .from('audit_logs')
          .select('id, occurred_at, title, detail, actor_role, action')
          .eq('subject_type', 'complaint')
          .eq('subject_id', route.params.complaintId)
          .order('occurred_at', { ascending: false })
          .limit(20),
      ]);

      if (!m) return;
      if (complaintRes.error) {
        setErr(complaintRes.error.message);
        setComplaint(null);
      } else if (!complaintRes.data) {
        setErr('Complaint not found (or blocked by RLS).');
        setComplaint(null);
      } else {
        const r = complaintRes.data as Record<string, unknown>;
        const order = r.order as Record<string, unknown> | undefined;
        const outlet = order?.outlet as Record<string, unknown> | undefined;
        const merchant = outlet?.merchant as Record<string, unknown> | undefined;
        const bag = order?.bag as Record<string, unknown> | undefined;
        const reporter = r.reporter as Record<string, unknown> | undefined;
        const detail: ComplaintDetail = {
          id: String(r.id ?? ''),
          type: String(r.type ?? 'Complaint'),
          description: String(r.description ?? ''),
          status: String(r.status ?? 'open'),
          resolution: String(r.resolution ?? ''),
          admin_notes: String(r.admin_notes ?? ''),
          photos: Array.isArray(r.photos) ? (r.photos as unknown[]).map((p) => String(p)) : [],
          created_at: typeof r.created_at === 'string' ? r.created_at : null,
          resolved_at: typeof r.resolved_at === 'string' ? r.resolved_at : null,
          resolved_by: String(r.resolved_by ?? ''),
          order_id: String(order?.id ?? ''),
          order_code: String(order?.reservation_code ?? ''),
          order_total: Number(order?.total ?? 0),
          bag_title: String(bag?.title ?? '') || 'Rescue bag',
          outlet_name: String(outlet?.name ?? '') || 'Outlet',
          merchant_name: String(merchant?.business_name ?? '') || 'Merchant',
          reporter_name: String(reporter?.full_name ?? '') || 'Customer',
          reporter_phone: String(reporter?.phone ?? ''),
        };
        setComplaint(detail);
        setResolutionDraft(detail.resolution);
        setAdminNotesDraft(detail.admin_notes);
        setErr(null);
      }

      setAuditTrail(
        ((auditRes.data ?? []) as Record<string, unknown>[]).map((a) => ({
          id: String(a.id ?? ''),
          title: String(a.title ?? a.action ?? 'event'),
          detail: String(a.detail ?? ''),
          actor: String(a.actor_role ?? 'system'),
          at: typeof a.occurred_at === 'string' ? (a.occurred_at as string) : null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok, route.params.complaintId, reloadKey]);

  const performAction = useCallback(
    async (action: 'escalate' | 'resolve' | 'reopen' | 'open') => {
      if (!complaint) return;
      setBusy(true);
      const sb = getSupabase(env);
      const stamp = new Date().toISOString();
      const patch: Record<string, unknown> = {};
      if (action === 'escalate') {
        patch.status = 'escalated';
      } else if (action === 'open' || action === 'reopen') {
        patch.status = 'open';
        patch.resolved_at = null;
        patch.resolved_by = null;
      } else {
        patch.status = 'resolved';
        patch.resolved_at = stamp;
        patch.resolved_by = user?.id ?? null;
        patch.resolution = resolutionDraft.trim() || 'Resolved in-app';
      }
      const { error } = await sb
        .from('complaints')
        .update(patch)
        .eq('id', complaint.id);
      setBusy(false);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [complaint, env, resolutionDraft, user?.id],
  );

  const issueRefund = useCallback(async () => {
    if (!complaint?.order_id) {
      Alert.alert('No order linked', 'This complaint is not tied to an order.');
      return;
    }
    setBusy(true);
    const token = (await getSupabase(env).auth.getSession()).data.session?.access_token;
    if (!token) {
      setBusy(false);
      Alert.alert('Refund failed', 'Not signed in.');
      return;
    }
    const result = await postOrderRefund(env.apiBaseUrl, token, {
      order_id: String(complaint.order_id),
      complaint_id: String(complaint.id),
      reason: resolutionDraft.trim() || 'Admin refund via complaint resolution',
    });
    setBusy(false);
    if (result.error) {
      Alert.alert('Refund failed', result.error);
      return;
    }
    setReloadKey((k) => k + 1);
  }, [complaint, env, resolutionDraft]);

  const saveAdminNotes = useCallback(async () => {
    if (!complaint) return;
    setBusy(true);
    const sb = getSupabase(env);
    const { error } = await sb
      .from('complaints')
      .update({ admin_notes: adminNotesDraft.trim() || null })
      .eq('id', complaint.id);
    setBusy(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  }, [adminNotesDraft, complaint, env]);

  if (!ok) {
    return <AdminOnlyNotice />;
  }
  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, paddingBottom: scrollBottomPad } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }
  if (err || !complaint) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
        <PolicyHint message={err ?? 'Complaint not found'} />
        <StitchButton title="Back to complaints" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  const status = complaint.status.toLowerCase();
  const isResolved = status === 'resolved' || status === 'closed';
  const isHigh = String(complaint.type).toLowerCase().includes('missing') || status === 'escalated';
  const pill = statusPillTokens(complaint.status, colors);

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StitchText variant="h1" colorKey="text">{complaint.type}</StitchText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.full,
            backgroundColor: pill.bg,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: pill.dot }} />
          <StitchText variant="label-caps" colorKey="text" style={{ color: pill.fg }}>
            {complaint.status}
          </StitchText>
        </View>
      </View>
      <StitchText variant="body-sm" colorKey="textMuted">
        Reported {complaint.created_at ? new Date(complaint.created_at).toLocaleString() : '—'}
      </StitchText>

      <StitchSurface
        elevated
        padding="md"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: isHigh ? colors.accent : colors.secondary,
        }}
      >
        <StitchText variant="h3" colorKey="text">Customer report</StitchText>
        <StitchText variant="body-md" colorKey="text" style={{ marginTop: spacing.sm }}>
          {complaint.description || '— no description provided —'}
        </StitchText>
        {complaint.photos.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <StitchIcon name="photo_camera" size={16} colorKey="primaryContainer" />
              <StitchText variant="label-caps" colorKey="primaryContainer">
                Evidence ({complaint.photos.length})
              </StitchText>
            </View>
            <ComplaintEvidenceGrid urls={complaint.photos} />
          </View>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Moderation</StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          Update status or leave internal notes for other admins.
        </StitchText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
          {(['open', 'escalated', 'resolved'] as const).map((key) => {
            const on = status === key || (key === 'open' && status === 'unresolved');
            return (
              <Pressable
                key={key}
                disabled={busy || (key === 'resolved' && isResolved)}
                onPress={() => {
                  if (key === 'resolved') void performAction('resolve');
                  else if (key === 'escalated') void performAction('escalate');
                  else void performAction('open');
                }}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                  borderRadius: radii.full,
                  backgroundColor: on ? colors.primaryContainer : colors.surface,
                  borderWidth: 1,
                  borderColor: on ? colors.primaryContainer : colors.outlineVariant,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <StitchText variant="label" colorKey={on ? 'onPrimary' : 'textMuted'}>
                  {key}
                </StitchText>
              </Pressable>
            );
          })}
        </View>
        <StitchText variant="label-caps" colorKey="textMuted" style={{ marginTop: spacing.md }}>
          Admin notes
        </StitchText>
        <TextInput
          value={adminNotesDraft}
          onChangeText={setAdminNotesDraft}
          placeholder="Internal notes (not visible to customer)"
          placeholderTextColor={colors.textMuted}
          multiline
          style={{
            marginTop: spacing.sm,
            minHeight: 72,
            borderWidth: 1,
            borderColor: colors.outlineVariant,
            borderRadius: radii.default,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
            textAlignVertical: 'top',
          }}
        />
        <StitchButton
          title={busy ? 'Saving…' : 'Save admin notes'}
          variant="secondary"
          disabled={busy}
          onPress={() => void saveAdminNotes()}
          style={{ marginTop: spacing.sm }}
        />
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">Linked order</StitchText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Reservation</StitchText>
            <StitchText variant="label" colorKey="text">
              {complaint.order_code ? `#${complaint.order_code}` : '—'}
            </StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Total</StitchText>
            <StitchText variant="label" colorKey="text">
              Rs. {Math.round(complaint.order_total).toLocaleString()}
            </StitchText>
          </View>
        </View>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
          {complaint.bag_title} · {complaint.merchant_name} · {complaint.outlet_name}
        </StitchText>
        {complaint.order_id ? (
          <StitchButton
            title="Open order"
            variant="secondary"
            onPress={() => {
              const nav = navigation as unknown as AdminCrossTabNavigation;
              nav.navigate('AdminOrdersTab', {
                screen: 'AdminPlatformOrderDetail',
                params: { orderId: complaint.order_id },
              });
            }}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">Reporter</StitchText>
        <StitchText variant="body-md" colorKey="text" style={{ marginTop: 4 }}>
          {complaint.reporter_name}
        </StitchText>
        {complaint.reporter_phone ? (
          <StitchText variant="body-sm" colorKey="textMuted">{complaint.reporter_phone}</StitchText>
        ) : null}
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Resolution</StitchText>
        {isResolved ? (
          <>
            <StitchText variant="body-md" colorKey="text" style={{ marginTop: spacing.sm }}>
              {complaint.resolution || 'Marked resolved (no note).'}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Closed {complaint.resolved_at ? new Date(complaint.resolved_at).toLocaleString() : '—'}
            </StitchText>
            <StitchButton
              title={busy ? 'Working…' : 'Reopen complaint'}
              variant="secondary"
              disabled={busy}
              onPress={() => void performAction('reopen')}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : (
          <>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              Note becomes the `resolution` column when you mark this resolved.
            </StitchText>
            <TextInput
              value={resolutionDraft}
              onChangeText={setResolutionDraft}
              placeholder="What did you do to address the issue?"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                marginTop: spacing.sm,
                minHeight: 88,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.text,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <StitchButton
                title={busy ? 'Working…' : 'Mark resolved'}
                variant="primary"
                disabled={busy}
                onPress={() => void performAction('resolve')}
                style={{ flex: 1 }}
              />
              <StitchButton
                title={busy ? 'Working…' : 'Escalate'}
                variant="secondary"
                disabled={busy || status === 'escalated'}
                onPress={() => void performAction('escalate')}
                style={{ flex: 1 }}
              />
            </View>
            {complaint.order_id ? (
              <StitchButton
                title={busy ? 'Working…' : 'Refund order & resolve'}
                variant="secondary"
                disabled={busy || isResolved}
                onPress={() => void issueRefund()}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </>
        )}
      </StitchSurface>

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <StitchText variant="h3" colorKey="text">Audit trail</StitchText>
        {auditTrail.length === 0 ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            No audit events recorded for this complaint yet.
          </StitchText>
        ) : (
          auditTrail.map((a, idx) => (
            <View
              key={a.id}
              style={{
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === auditTrail.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <StitchText variant="label" colorKey="text">{a.title}</StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {a.at ? new Date(a.at).toLocaleString() : '—'}
                </StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted">{a.detail}</StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">by {a.actor}</StitchText>
            </View>
          ))
        )}
      </StitchSurface>
    </StitchScreen>
  );
}

type SettlementDetail = {
  id: string;
  merchant_name: string;
  merchant_id: string;
  payout_method: string;
  status: string;
  net_payout: number;
  gross_sales: number;
  commission_amount: number;
  card_fees: number;
  total_orders: number;
  card_count: number;
  cash_count: number;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
  bank_details: Record<string, unknown> | null;
  notes: string;
};

type SettlementOrderRow = {
  id: string;
  reservation_code: string;
  total: number;
  platform_fee: number;
  order_status: string;
  collected_at: string | null;
  created_at: string | null;
  bag_title: string;
};

export function AdminSettlementDetailScreen() {
  const route = useRoute<RouteProp<AdminStackParamList, 'AdminSettlementDetail'>>();
  const navigation = useNavigation<AdminNav>();
  const { env } = useAuthContext();
  const { spacing, colors, radii } = useStitchTheme();
  const scrollBottomPad = useScrollContentBottomPad();
  const ok = useAdminGate();
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [orderRows, setOrderRows] = useState<SettlementOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ok) return;
    let m = true;
    (async () => {
      setLoading(true);
      const sb = getSupabase(env);
      const settlementRes = await sb
        .from('settlements')
        .select(
          `
          id,
          status,
          net_payout,
          gross_sales,
          commission_amount,
          card_processing_fees,
          total_orders,
          card_orders_count,
          cash_orders_count,
          created_at,
          period_start,
          period_end,
          notes,
          merchant:merchants(id, business_name, payout_method, bank_details)
        `,
        )
        .eq('id', route.params.settlementId)
        .maybeSingle();

      if (!m) return;
      if (settlementRes.error) {
        setErr(settlementRes.error.message);
        setSettlement(null);
        setLoading(false);
        return;
      }
      if (!settlementRes.data) {
        setErr('Settlement not found (or blocked by RLS).');
        setSettlement(null);
        setLoading(false);
        return;
      }

      const r = settlementRes.data as Record<string, unknown>;
      const merchant = r.merchant as Record<string, unknown> | undefined;
      const merchantId = String(merchant?.id ?? '');
      const periodStart = typeof r.period_start === 'string' ? (r.period_start as string) : null;
      const periodEnd = typeof r.period_end === 'string' ? (r.period_end as string) : null;
      const created = typeof r.created_at === 'string' ? (r.created_at as string) : null;
      const detail: SettlementDetail = {
        id: String(r.id ?? ''),
        merchant_id: merchantId,
        merchant_name: String(merchant?.business_name ?? '') || 'Merchant',
        payout_method: String(merchant?.payout_method ?? ''),
        status: String(r.status ?? 'pending'),
        net_payout: Number(r.net_payout ?? 0),
        gross_sales: Number(r.gross_sales ?? 0),
        commission_amount: Number(r.commission_amount ?? 0),
        card_fees: Number(r.card_processing_fees ?? 0),
        total_orders: Number(r.total_orders ?? 0),
        card_count: Number(r.card_orders_count ?? 0),
        cash_count: Number(r.cash_orders_count ?? 0),
        created_at: created,
        period_start: periodStart,
        period_end: periodEnd,
        notes: String(r.notes ?? ''),
        bank_details:
          merchant?.bank_details && typeof merchant.bank_details === 'object'
            ? (merchant.bank_details as Record<string, unknown>)
            : null,
      };

      let ordersData: Record<string, unknown>[] = [];
      if (merchantId) {
        const startIso = periodStart ?? (created ? new Date(new Date(created).getTime() - 7 * 24 * 3600 * 1000).toISOString() : null);
        const endIso = periodEnd ?? created ?? new Date().toISOString();
        const { data } = await sb
          .from('orders')
          .select(
            `
            id,
            reservation_code,
            total,
            platform_fee,
            order_status,
            collected_at,
            created_at,
            outlet:outlets(merchant_id),
            bag:rescue_bags(title)
          `,
          )
          .in('order_status', ['collected', 'completed'])
          .gte('collected_at', startIso ?? new Date(0).toISOString())
          .lte('collected_at', endIso)
          .order('collected_at', { ascending: false })
          .limit(100);
        ordersData = ((data ?? []) as Record<string, unknown>[]).filter((o) => {
          const outlet = o.outlet as Record<string, unknown> | undefined;
          return String(outlet?.merchant_id ?? '') === merchantId;
        });
      }

      if (!m) return;
      setSettlement(detail);
      setOrderRows(
        ordersData.map((o) => {
          const bag = o.bag as Record<string, unknown> | undefined;
          return {
            id: String(o.id ?? ''),
            reservation_code: String(o.reservation_code ?? ''),
            total: Number(o.total ?? 0),
            platform_fee: Number(o.platform_fee ?? 0),
            order_status: String(o.order_status ?? ''),
            collected_at: typeof o.collected_at === 'string' ? (o.collected_at as string) : null,
            created_at: typeof o.created_at === 'string' ? (o.created_at as string) : null,
            bag_title: String(bag?.title ?? '') || 'Rescue bag',
          };
        }),
      );
      setErr(null);
      setLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, ok, route.params.settlementId, reloadKey]);

  const advanceStatus = useCallback(
    async (next: 'processing' | 'paid' | 'failed') => {
      if (!settlement) return;
      setBusy(true);
      const sb = getSupabase(env);
      const patch: Record<string, unknown> = { status: next };
      const { error } = await sb.from('settlements').update(patch).eq('id', settlement.id);
      setBusy(false);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      setReloadKey((k) => k + 1);
    },
    [env, settlement],
  );

  if (!ok) {
    return <AdminOnlyNotice />;
  }
  if (loading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, paddingBottom: scrollBottomPad } }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }
  if (err || !settlement) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
        <PolicyHint message={err ?? 'Settlement not found'} />
        <StitchButton title="Back to settlements" variant="secondary" onPress={() => navigation.goBack()} />
      </StitchScreen>
    );
  }

  const pill = statusPillTokens(settlement.status, colors);
  const isPaid = settlement.status.toLowerCase() === 'paid' || settlement.status.toLowerCase() === 'completed';
  const lineTotal = orderRows.reduce((sum, r) => sum + r.total, 0);
  const lineFees = orderRows.reduce((sum, r) => sum + r.platform_fee, 0);

  return (
    <StitchScreen scroll scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile, gap: spacing.md, paddingBottom: scrollBottomPad } }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Settlement #{settlement.id.slice(0, 8).toUpperCase()}
          </StitchText>
          <StitchText variant="h1" colorKey="text">{settlement.merchant_name}</StitchText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.full,
            backgroundColor: pill.bg,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: pill.dot }} />
          <StitchText variant="label-caps" colorKey="text" style={{ color: pill.fg }}>
            {settlement.status}
          </StitchText>
        </View>
      </View>

      <StitchSurface elevated padding="md">
        <StitchText variant="label-caps" colorKey="textMuted">Net payout</StitchText>
        <StitchText variant="display" colorKey="primary" style={{ marginTop: 4 }}>
          Rs. {Math.round(settlement.net_payout).toLocaleString()}
        </StitchText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Gross sales</StitchText>
            <StitchText variant="label" colorKey="text">
              Rs. {Math.round(settlement.gross_sales).toLocaleString()}
            </StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Commission</StitchText>
            <StitchText variant="label" colorKey="accent">
              −Rs. {Math.round(settlement.commission_amount).toLocaleString()}
            </StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Card fees</StitchText>
            <StitchText variant="label" colorKey="accent">
              −Rs. {Math.round(settlement.card_fees).toLocaleString()}
            </StitchText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Period</StitchText>
            <StitchText variant="body-sm" colorKey="text">
              {settlement.period_start
                ? new Date(settlement.period_start).toLocaleDateString()
                : '—'}
              {' → '}
              {settlement.period_end
                ? new Date(settlement.period_end).toLocaleDateString()
                : '—'}
            </StitchText>
          </View>
          <View style={{ flex: 1 }}>
            <StitchText variant="label-caps" colorKey="textMuted">Orders</StitchText>
            <StitchText variant="body-sm" colorKey="text">
              {settlement.total_orders.toLocaleString()} ({settlement.card_count} card · {settlement.cash_count} cash)
            </StitchText>
          </View>
        </View>
        {settlement.notes ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            Note: {settlement.notes}
          </StitchText>
        ) : null}
      </StitchSurface>

      {settlement.bank_details ? (
        <StitchSurface elevated padding="md">
          <StitchText variant="h3" colorKey="text">Payout destination</StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Method: {settlement.payout_method || 'bank_transfer'}
          </StitchText>
          {Object.entries(settlement.bank_details).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <StitchText variant="body-sm" colorKey="textMuted">{k}</StitchText>
              <StitchText variant="body-sm" colorKey="text" numberOfLines={1} style={{ marginLeft: spacing.md }}>
                {typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)}
              </StitchText>
            </View>
          ))}
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md" style={{ borderWidth: 1, borderColor: colors.divider }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <StitchText variant="h3" colorKey="text">Included orders</StitchText>
          <StitchText variant="label-caps" colorKey="textMuted">
            {orderRows.length} · Rs. {Math.round(lineTotal).toLocaleString()}
          </StitchText>
        </View>
        {orderRows.length === 0 ? (
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            No collected orders found in this settlement window for the merchant.
          </StitchText>
        ) : (
          orderRows.map((o, idx) => (
            <Pressable
              key={o.id}
              onPress={() => navigation.navigate('AdminPlatformOrderDetail', { orderId: o.id })}
              style={({ pressed }) => ({
                paddingVertical: spacing.sm,
                borderBottomWidth: idx === orderRows.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StitchText variant="label" colorKey="text" style={{ flex: 1 }} numberOfLines={1}>
                  {o.reservation_code ? `#${o.reservation_code}` : o.id.slice(0, 8).toUpperCase()} · {o.bag_title}
                </StitchText>
                <StitchText variant="label" colorKey="text">
                  Rs. {Math.round(o.total).toLocaleString()}
                </StitchText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {o.collected_at ? new Date(o.collected_at).toLocaleString() : '—'}
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  fee Rs. {Math.round(o.platform_fee).toLocaleString()}
                </StitchText>
              </View>
            </Pressable>
          ))
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
          <StitchText variant="label-caps" colorKey="textMuted">Fees in window</StitchText>
          <StitchText variant="label" colorKey="text">Rs. {Math.round(lineFees).toLocaleString()}</StitchText>
        </View>
      </StitchSurface>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <StitchButton
          title={busy ? 'Working…' : 'Mark processing'}
          variant="secondary"
          disabled={busy || isPaid}
          onPress={() => void advanceStatus('processing')}
          style={{ flex: 1, minWidth: 140 }}
        />
        <StitchButton
          title={busy ? 'Working…' : 'Mark paid'}
          variant="primary"
          disabled={busy || isPaid}
          onPress={() => void advanceStatus('paid')}
          style={{ flex: 1, minWidth: 140 }}
        />
        <StitchButton
          title={busy ? 'Working…' : 'Flag failed'}
          variant="secondary"
          disabled={busy}
          onPress={() => void advanceStatus('failed')}
          style={{ flex: 1, minWidth: 140 }}
        />
      </View>
    </StitchScreen>
  );
}
