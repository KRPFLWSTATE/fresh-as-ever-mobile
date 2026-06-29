import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import { useMerchantFinance } from '@/hooks/useMerchantFinance';
import {
  useMerchantSettlements,
  type MerchantSettlementRow,
} from '@/hooks/useMerchantSettlements';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type PayoutRowModel = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: 'processing' | 'paid';
};

function settlementToRow(s: MerchantSettlementRow): PayoutRowModel {
  const tsRaw = s.period_end ?? s.created_at ?? null;
  const ts = tsRaw
    ? new Date(tsRaw).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
      })
    : '—';
  const lower = s.status.toLowerCase();
  const uiStatus: 'processing' | 'paid' = lower === 'paid' || lower === 'completed' ? 'paid' : 'processing';
  return {
    id: s.id,
    title:
      uiStatus === 'paid'
        ? `Payout · settled ${ts}`
        : `Payout · ${s.status} window`,
    subtitle: `${s.total_orders.toLocaleString()} orders · Rs ${Math.round(s.gross_sales).toLocaleString()} gross`,
    amount: `Rs ${s.net_payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    status: uiStatus,
  };
}

const PLATFORM_FEE_RATE = 0.15;

function parseLkrAmount(raw: string): number {
  const cleaned = String(raw)
    .replace(/rs\.?/gi, '')
    .replace(/,/g, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatLkr(n: number): string {
  return `Rs ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function MerchantFinanceScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { summary, loading, error, refetch } = useMerchantFinance(env);
  const {
    rows: settlementRows,
    loading: settlementsLoading,
    error: settlementsError,
    refetch: refetchSettlements,
  } = useMerchantSettlements(env, 5);
  const { colors, radii, spacing } = useStitchTheme();

  const payoutRows: PayoutRowModel[] = useMemo(
    () => settlementRows.map(settlementToRow),
    [settlementRows],
  );

  const lifetimeNum = useMemo(
    () => parseLkrAmount(summary.lifetime),
    [summary.lifetime],
  );
  const commissionStr = useMemo(
    () => formatLkr(Math.round(lifetimeNum * PLATFORM_FEE_RATE * 100) / 100),
    [lifetimeNum],
  );

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const row: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    const iconDisc: ViewStyle = {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const chipBase: ViewStyle = {
      marginTop: 4,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.default,
    };
    const err: TextStyle = { color: colors.error };
    const statRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    };
    const nextPayoutWrap: ViewStyle = {
      borderRadius: radii.xl,
      backgroundColor: colors.primaryContainer,
      padding: spacing.md,
      overflow: 'hidden',
    };
    const nextPayoutWatermark: ViewStyle = {
      position: 'absolute',
      right: -8,
      bottom: -16,
      opacity: 0.12,
    };
    const nextPayoutInner: ViewStyle = { position: 'relative', zIndex: 1 };
    const listFooter: ViewStyle = {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surfaceBright,
      alignItems: 'center',
    };
    const linkPress: ViewStyle = {
      paddingVertical: spacing.sm,
      alignSelf: 'flex-start',
    };
    const listCard: ViewStyle = { overflow: 'hidden' };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.md,
      },
      headerBlock: { marginBottom: spacing.sm },
      statRow,
      nextPayoutWrap,
      nextPayoutWatermark,
      nextPayoutInner,
      sectionTitle: { marginBottom: spacing.md, marginTop: spacing.lg },
      listCard,
      listFooter,
      linkPress,
      row,
      iconDisc,
      chipBase,
      cardBorder,
      err,
    };
  }, [colors, radii, spacing]);

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <View style={styles.headerBlock}>
        <StitchText variant="h1" colorKey="text">
          Finance
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          Overview and payout history
        </StitchText>
        <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: 8 }}>
          Settlement-driven payouts — not live handover revenue. Today&apos;s pickup totals on Home
          update when you complete handovers.
        </StitchText>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : null}
      {error ? (
        <StitchText variant="body-md" style={styles.err}>
          {error}
        </StitchText>
      ) : null}

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={styles.statRow}>
            <StitchIcon name="account_balance_wallet" size={22} colorKey="textMuted" />
            <StitchText variant="label" colorKey="textMuted">
              Total Earnings
            </StitchText>
          </View>
          {/*
            Stitch `merchant_finance_refined_*` adds a small trend pill ("+12% last
            month"). We derive the ratio from this month's vs last month's paid+collected
            gross in `useMerchantFinance`; the pill is omitted when there is no baseline.
          */}
          {summary.trendPercent != null ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.full,
                backgroundColor:
                  summary.trendPercent >= 0
                    ? `${colors.success}1F`
                    : `${colors.error}1F`,
              }}
            >
              <StitchIcon
                name={summary.trendPercent >= 0 ? 'trending_up' : 'arrow_downward'}
                size={14}
                colorKey={summary.trendPercent >= 0 ? 'success' : 'error'}
              />
              <StitchText
                variant="label"
                colorKey={summary.trendPercent >= 0 ? 'success' : 'error'}
              >
                {summary.trendPercent >= 0 ? '+' : ''}
                {summary.trendPercent}% last month
              </StitchText>
            </View>
          ) : null}
        </View>
        <StitchText variant="price" colorKey="text">
          {summary.lifetime}
        </StitchText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <StitchIcon name="trending_up" size={16} colorKey="success" />
          <StitchText variant="body-sm" colorKey="success">
            Paid & collected orders (gross)
          </StitchText>
        </View>
      </StitchSurface>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <View style={styles.statRow}>
          <StitchIcon name="percent" size={22} colorKey="textMuted" />
          <StitchText variant="label" colorKey="textMuted">
            Platform Commission (15%)
          </StitchText>
        </View>
        <StitchText variant="price" colorKey="text">
          {commissionStr}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: 8 }}>
          Deducted automatically
        </StitchText>
      </StitchSurface>

      <View style={styles.nextPayoutWrap}>
        <View style={styles.nextPayoutWatermark}>
          <StitchIcon name="payments" size={120} colorKey="onPrimary" />
        </View>
        <View style={styles.nextPayoutInner}>
          <View style={styles.statRow}>
            <StitchIcon name="event" size={22} colorKey="primaryHighlight" />
            <StitchText variant="label" colorKey="primaryHighlight">
              Pending payout
            </StitchText>
          </View>
          <StitchText variant="price" colorKey="onPrimary">
            {summary.pending}
          </StitchText>
          <StitchText variant="body-sm" colorKey="primaryHighlight" style={{ marginTop: 8 }}>
            Sum of settlements still in `pending` / `processing`.
          </StitchText>
        </View>
      </View>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <View style={styles.statRow}>
          <StitchIcon name="account_balance" size={22} colorKey="textMuted" />
          <StitchText variant="label" colorKey="textMuted">
            Paid out
          </StitchText>
        </View>
        <StitchText variant="price" colorKey="text">
          {summary.paidOut}
        </StitchText>
        <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: 8 }}>
          Sum of all settlements marked `paid` or `completed`. Withdrawable balance is not shown
          until payout requests are modelled — contact support to request a transfer.
        </StitchText>
      </StitchSurface>

      <StitchText variant="h2" colorKey="text" style={styles.sectionTitle}>
        Recent Payouts
      </StitchText>

      {settlementsError ? (
        <StitchText variant="body-sm" style={styles.err}>
          {settlementsError}
        </StitchText>
      ) : null}

      {settlementsLoading ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : settlementRows.length === 0 ? (
        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <StitchText variant="label" colorKey="text">
            No settlements yet
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Once your first batch is processed by the platform, it will appear here. Payouts are
            grouped by settlement window.
          </StitchText>
        </StitchSurface>
      ) : (
        <StitchSurface elevated padding="none" style={[styles.cardBorder, styles.listCard]}>
          {payoutRows.map((row, index) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('MerchantPayoutDetail', { payoutId: row.id })
              }
              style={({ pressed }) => [
                styles.row,
                index === payoutRows.length - 1 && { borderBottomWidth: 0 },
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                <View style={styles.iconDisc}>
                  <StitchIcon name="receipt_long" size={22} colorKey="textMuted" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <StitchText variant="label" colorKey="text" numberOfLines={2}>
                    {row.title}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textFaint" numberOfLines={1}>
                    {row.subtitle}
                  </StitchText>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <StitchText variant="price" colorKey="text" style={{ fontWeight: '600' }}>
                  {row.amount}
                </StitchText>
                <View
                  style={[
                    styles.chipBase,
                    row.status === 'processing'
                      ? { backgroundColor: `${colors.accentHighlight}4D` }
                      : { backgroundColor: `${colors.success}1A` },
                  ]}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor:
                        row.status === 'processing' ? colors.accent : colors.success,
                    }}
                  />
                  <StitchText
                    variant="label-caps"
                    colorKey={row.status === 'processing' ? 'accent' : 'success'}
                  >
                    {row.status === 'processing' ? 'Processing' : 'Paid'}
                  </StitchText>
                </View>
              </View>
            </Pressable>
          ))}
          <View style={styles.listFooter}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('MerchantPayouts')}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                View All Payouts
              </StitchText>
            </Pressable>
          </View>
        </StitchSurface>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void refetch();
          void refetchSettlements();
        }}
        style={styles.linkPress}
      >
        <StitchText variant="label" colorKey="primaryContainer">
          Refresh
        </StitchText>
      </Pressable>
    </StitchScreen>
  );
}
