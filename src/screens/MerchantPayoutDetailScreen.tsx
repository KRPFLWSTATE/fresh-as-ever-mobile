import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { payoutIdParam } from '@/contracts/routeParams';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import {
  formatSettlementLkr,
  parseSettlementBreakdown,
} from '@/lib/merchantSettlementBreakdown';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type TxRow = { id: string; when: string; item: string; orderId: string; share: string };

type PayoutDetailModel = {
  periodTitle: string;
  settled: boolean;
  ref: string;
  net: string;
  bankTransferLine: string;
  gross: string;
  grossSub: string;
  commission: string;
  commissionSub: string;
  cardFees: string | null;
  cashCommissionDue: string | null;
  bankName: string;
  branch: string;
  acctMasked: string;
  txCount: number;
  transactions: TxRow[];
};

/**
 * Build a {@link PayoutDetailModel} from a live `settlements` row + the orders the merchant
 * actually settled during that window. Mirrors the admin settlement detail filter so the
 * merchant view stays consistent with what platform ops sees.
 */
function buildDetailFromLive(args: {
  settlement: Record<string, unknown>;
  orders: Record<string, unknown>[];
  bagTitleById: Record<string, string>;
  bankDetails: Record<string, unknown> | null;
}): PayoutDetailModel {
  const { settlement, orders, bagTitleById, bankDetails } = args;
  const status = String(settlement.status ?? 'pending').toLowerCase();
  const settled = status === 'paid' || status === 'completed';
  const periodStartRaw =
    typeof settlement.period_start === 'string' ? (settlement.period_start as string) : null;
  const periodEndRaw =
    typeof settlement.period_end === 'string' ? (settlement.period_end as string) : null;
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
  const periodTitle =
    periodStartRaw && periodEndRaw
      ? `${fmtDate(periodStartRaw)} – ${fmtDate(periodEndRaw)}`
      : settled
        ? `Settled ${fmtDate(typeof settlement.created_at === 'string' ? (settlement.created_at as string) : null)}`
        : 'Settlement window';
  const fmtLkr = (n: number) => formatSettlementLkr(n);

  const breakdown = parseSettlementBreakdown(settlement);
  const net = fmtLkr(breakdown.net);
  const gross = fmtLkr(breakdown.gross);
  const commission = fmtLkr(breakdown.commission);
  const cardFees =
    breakdown.cardFees > 0 ? fmtLkr(breakdown.cardFees) : null;
  const cashCommissionDue =
    breakdown.cashCommissionDue > 0
      ? fmtLkr(breakdown.cashCommissionDue)
      : null;

  const bankName =
    String((bankDetails?.bank_name ?? bankDetails?.bank ?? '') as string) || 'Bank on file';
  const branch = String((bankDetails?.branch ?? '') as string) || '—';
  const acct = String((bankDetails?.account_number ?? '') as string);
  const acctMasked = acct ? `****${acct.slice(-4)}` : '****0000';

  const txRows: TxRow[] = orders.map((o) => {
    const id = String(o.id ?? '');
    const ts = typeof o.collected_at === 'string'
      ? (o.collected_at as string)
      : typeof o.created_at === 'string'
        ? (o.created_at as string)
        : null;
    const when = ts
      ? new Date(ts).toLocaleString(undefined, {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
    const bagId = String(o.bag_id ?? '');
    const item = bagId && bagTitleById[bagId] ? bagTitleById[bagId] : 'Rescue bag';
    const orderId = String(o.reservation_code ?? id.slice(0, 6).toUpperCase());
    const grossAmt = Number(o.total ?? 0);
    const fee = Number(o.platform_fee ?? 0);
    const share = fmtLkr(grossAmt - fee);
    return { id, when, item, orderId: `#${orderId}`, share };
  });

  return {
    periodTitle,
    settled,
    ref: `Ref: ${String(settlement.id ?? '').slice(0, 8).toUpperCase()}`,
    net,
    bankTransferLine: settled
      ? `Transferred to ${bankName}${acct ? ` ending in *${acct.slice(-4)}` : ''}`
      : `Will transfer to ${bankName}${acct ? ` ending in *${acct.slice(-4)}` : ''}`,
    gross,
    grossSub: `${Number(settlement.total_orders ?? txRows.length)} settled orders`,
    commission,
    commissionSub: '15% platform fee (deducted at source)',
    cardFees,
    cashCommissionDue,
    bankName,
    branch,
    acctMasked,
    txCount: Number(settlement.total_orders ?? txRows.length),
    transactions: txRows,
  };
}

export function MerchantPayoutDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'MerchantPayoutDetail'>>();
  const parsed = payoutIdParam.safeParse(route.params);
  const { env } = useAuthContext();
  const { merchant, outlets, loading: ctxLoading } = useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();

  const id = parsed.success ? parsed.data.payoutId : '';
  const [liveDetail, setLiveDetail] = useState<PayoutDetailModel | null>(null);
  const [liveLoading, setLiveLoading] = useState(Boolean(id));
  const [liveError, setLiveError] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const merchantId = merchant?.id ? String(merchant.id) : '';
  const outletIds = useMemo(() => outlets.map((o) => String(o.id)), [outlets]);

  useEffect(() => {
    if (!id) {
      setLiveLoading(false);
      return;
    }
    if (ctxLoading) return;
    let m = true;
    (async () => {
      setLiveLoading(true);
      setLiveError(null);
      const sb = getSupabase(env);
      const settlementRes = await sb
        .from('settlements')
        .select(
          'id, status, net_payout, gross_sales, commission_amount, card_processing_fees, cash_orders_commission_due, total_orders, card_orders_count, cash_orders_count, created_at, period_start, period_end, notes, merchant_id, merchant:merchants(payout_method, bank_details)',
        )
        .eq('id', id)
        .maybeSingle();

      if (!m) return;
      if (settlementRes.error || !settlementRes.data) {
        setLiveError(settlementRes.error?.message ?? 'Settlement not found (or blocked by RLS).');
        setLiveDetail(null);
        setLiveLoading(false);
        return;
      }

      const settlement = settlementRes.data as Record<string, unknown>;
      const merchantOfRow = String(settlement.merchant_id ?? '');
      if (merchantId && merchantOfRow && merchantOfRow !== merchantId) {
        // Guard against deep-link spoofing — RLS should already deny, but belt-and-braces.
        setLiveError('Payout does not belong to your account.');
        setLiveDetail(null);
        setLiveLoading(false);
        return;
      }

      const bankRaw = (settlement.merchant as Record<string, unknown> | undefined)?.bank_details;
      const bankDetails =
        bankRaw && typeof bankRaw === 'object' ? (bankRaw as Record<string, unknown>) : null;

      const periodStart =
        typeof settlement.period_start === 'string' ? (settlement.period_start as string) : null;
      const periodEnd =
        typeof settlement.period_end === 'string' ? (settlement.period_end as string) : null;
      const createdAt =
        typeof settlement.created_at === 'string' ? (settlement.created_at as string) : null;
      const startIso =
        periodStart ?? (createdAt ? new Date(new Date(createdAt).getTime() - 7 * 24 * 3600 * 1000).toISOString() : null);
      const endIso = periodEnd ?? createdAt ?? new Date().toISOString();

      let orderRows: Record<string, unknown>[] = [];
      let bagTitleById: Record<string, string> = {};
      if (outletIds.length > 0) {
        const { data: ordersData } = await sb
          .from('orders')
          .select(
            'id, reservation_code, total, platform_fee, order_status, collected_at, created_at, outlet_id, bag_id',
          )
          .in('outlet_id', outletIds)
          .in('order_status', ['collected', 'completed'])
          .gte('collected_at', startIso ?? new Date(0).toISOString())
          .lte('collected_at', endIso)
          .order('collected_at', { ascending: false })
          .limit(100);
        orderRows = (ordersData ?? []) as Record<string, unknown>[];
        const bagIds = Array.from(new Set(orderRows.map((o) => String(o.bag_id ?? '')).filter(Boolean)));
        if (bagIds.length > 0) {
          const { data: bagData } = await sb
            .from('rescue_bags')
            .select('id, title')
            .in('id', bagIds);
          ((bagData ?? []) as Record<string, unknown>[]).forEach((b) => {
            bagTitleById[String(b.id ?? '')] = String(b.title ?? '') || 'Rescue bag';
          });
        }
      }

      if (!m) return;
      setLiveDetail(
        buildDetailFromLive({
          settlement,
          orders: orderRows,
          bagTitleById,
          bankDetails,
        }),
      );
      setLiveLoading(false);
    })();
    return () => {
      m = false;
    };
  }, [env, id, ctxLoading, merchantId, outletIds]);

  const detail = useMemo(() => (id ? liveDetail : null), [id, liveDetail]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const statCard: ViewStyle = {
      flex: 1,
      minWidth: 0,
      borderRadius: radii.xl,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    const chipRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      flexWrap: 'wrap',
    };
    const settledChip: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.default,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.divider,
    };
    const tableHeader: ViewStyle = {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.surfaceBright,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    };
    const tableCell: TextStyle = { flex: 1 };
    const tableCellRight: TextStyle = { flex: 1, textAlign: 'right' };
    const txRow: ViewStyle = {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    const bankIconWrap: ViewStyle = {
      width: 40,
      height: 40,
      borderRadius: radii.default,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const bentoRow: ViewStyle = {
      flexDirection: 'row',
      gap: spacing.md,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      cardBorder,
      statCard,
      chipRow,
      settledChip,
      tableHeader,
      tableCell,
      tableCellRight,
      txRow,
      bankIconWrap,
      bentoRow,
    };
  }, [colors, radii, spacing]);

  if (!parsed.success) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: styles.content }}>
        <StitchText variant="body-md" colorKey="text">
          Missing payout reference.
        </StitchText>
      </StitchScreen>
    );
  }

  if (liveLoading) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: styles.content }}>
        <ActivityIndicator color={colors.primaryContainer} />
      </StitchScreen>
    );
  }

  if (!detail) {
    return (
      <StitchScreen scroll scrollProps={{ contentContainerStyle: styles.content }}>
        <StitchText variant="body-md" colorKey="text">
          {liveError ?? 'Payout not found.'}
        </StitchText>
      </StitchScreen>
    );
  }

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <View>
        <StitchText variant="label-caps" colorKey="textMuted">
          SETTLEMENT PERIOD
        </StitchText>
        <StitchText variant="h2" colorKey="text" style={{ marginTop: spacing.xs }}>
          {detail.periodTitle}
        </StitchText>
        <View style={styles.chipRow}>
          <View style={styles.settledChip}>
            <StitchIcon
              name={detail.settled ? 'check_circle' : 'schedule'}
              size={16}
              colorKey={detail.settled ? 'primaryContainer' : 'accent'}
            />
            <StitchText
              variant="label"
              colorKey={detail.settled ? 'primaryContainer' : 'accent'}
            >
              {detail.settled ? 'Settled' : 'Processing'}
            </StitchText>
          </View>
          <StitchText variant="body-sm" colorKey="textMuted">
            {detail.ref}
          </StitchText>
        </View>
      </View>

      <StitchSurface elevated padding="lg" style={styles.cardBorder}>
        <View style={{ gap: spacing.md }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <StitchIcon name="account_balance" size={20} colorKey="textMuted" />
              <StitchText variant="label" colorKey="textMuted">
                Net payout transferred
              </StitchText>
            </View>
            <StitchText variant="display" colorKey="primaryContainer" style={{ marginTop: spacing.xs }}>
              {detail.net}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
              {detail.bankTransferLine}
            </StitchText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open receipt actions"
            onPress={() => setReceiptOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.primaryContainer,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.lg,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <StitchIcon name="download" size={18} colorKey="onPrimary" />
            <StitchText variant="label" colorKey="onPrimary">
              Download receipt
            </StitchText>
          </Pressable>
        </View>
      </StitchSurface>

      <View style={styles.bentoRow}>
        <View style={styles.statCard}>
          <StitchText variant="label" colorKey="textMuted">
            Gross revenue
          </StitchText>
          <StitchText variant="h2" colorKey="text" style={{ marginTop: spacing.xs }}>
            {detail.gross}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            {detail.grossSub}
          </StitchText>
        </View>
        <View style={styles.statCard}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <StitchText variant="label" colorKey="textMuted">
              Platform commission
            </StitchText>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radii.default,
                backgroundColor: colors.surface2,
              }}
            >
              <StitchText variant="body-sm" colorKey="textMuted">
                15%
              </StitchText>
            </View>
          </View>
          <StitchText variant="h2" colorKey="accent" style={{ marginTop: spacing.xs }}>
            − {detail.commission}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
            {detail.commissionSub}
          </StitchText>
        </View>
      </View>

      {(detail.cardFees || detail.cashCommissionDue) ? (
        <StitchSurface elevated padding="md" style={styles.cardBorder}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Deductions
          </StitchText>
          {detail.cardFees ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.sm,
              }}
            >
              <StitchText variant="body-sm" colorKey="textMuted">
                Card processing fees
              </StitchText>
              <StitchText variant="body-sm" colorKey="accent">
                − {detail.cardFees}
              </StitchText>
            </View>
          ) : null}
          {detail.cashCommissionDue ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.sm,
              }}
            >
              <StitchText variant="body-sm" colorKey="textMuted">
                Cash order commission due
              </StitchText>
              <StitchText variant="body-sm" colorKey="accent">
                − {detail.cashCommissionDue}
              </StitchText>
            </View>
          ) : null}
          <StitchText variant="body-sm" colorKey="textFaint" style={{ marginTop: spacing.sm }}>
            Net payout = gross − platform commission − card fees − cash commission due.
          </StitchText>
        </StitchSurface>
      ) : null}

      <StitchSurface elevated padding="md" style={[styles.cardBorder, { flexDirection: 'row', gap: spacing.md }]}>
        <View style={styles.bankIconWrap}>
          <StitchIcon name="account_balance" size={22} colorKey="primaryContainer" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <StitchText variant="label" colorKey="text">
            {detail.bankName}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Branch: {detail.branch}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted">
            Acct: {detail.acctMasked}
          </StitchText>
        </View>
      </StitchSurface>

      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
          }}
        >
          <StitchText variant="h3" colorKey="text">
            Included transactions
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted">
            {detail.txCount} items
          </StitchText>
        </View>

        <StitchSurface elevated padding="none" style={styles.cardBorder}>
          <View style={styles.tableHeader}>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.tableCell}>
              Date & time
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.tableCell}>
              Item
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted" style={[styles.tableCell, { flex: 0.9 }]}>
              Order
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.tableCellRight}>
              Share
            </StitchText>
          </View>
          <FlatList
            data={detail.transactions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.txRow,
                  index === detail.transactions.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <StitchText variant="body-sm" colorKey="text" style={styles.tableCell} numberOfLines={2}>
                  {item.when}
                </StitchText>
                <StitchText variant="body-sm" colorKey="text" style={styles.tableCell} numberOfLines={2}>
                  {item.item}
                </StitchText>
                <StitchText
                  variant="body-sm"
                  colorKey="textMuted"
                  style={[styles.tableCell, { flex: 0.9 }]}
                  numberOfLines={1}
                >
                  {item.orderId}
                </StitchText>
                <StitchText variant="body-sm" colorKey="text" style={styles.tableCellRight}>
                  {item.share}
                </StitchText>
              </View>
            )}
          />
          <View
            style={{
              padding: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
              alignItems: 'center',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all transactions for this payout"
              onPress={() => {
                if (!id) return;
                navigation.navigate('MerchantPayoutTransactions', {
                  settlementId: id,
                });
              }}
            >
              <StitchText variant="label" colorKey="primaryContainer">
                View all transactions
              </StitchText>
            </Pressable>
          </View>
        </StitchSurface>
      </View>

      <StitchText variant="body-sm" colorKey="textMuted">
        Mobile shows identifiers and sample line items for support. Authoritative ledgers and CSV export
        live in the merchant web console.
      </StitchText>

      <Modal
        visible={receiptOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReceiptOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <StitchText variant="h3" colorKey="text">
                Receipt — {detail.periodTitle}
              </StitchText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close receipt sheet"
                onPress={() => setReceiptOpen(false)}
                style={{ padding: 6 }}
              >
                <StitchIcon name="close" size={20} colorKey="textMuted" />
              </Pressable>
            </View>

            <StitchText variant="body-sm" colorKey="textMuted">
              {detail.ref}
            </StitchText>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: radii.default,
                padding: spacing.md,
                gap: 6,
                marginTop: spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StitchText variant="body-sm" colorKey="textMuted">Gross</StitchText>
                <StitchText variant="body-sm" colorKey="text">{detail.gross}</StitchText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StitchText variant="body-sm" colorKey="textMuted">Commission</StitchText>
                <StitchText variant="body-sm" colorKey="text">− {detail.commission}</StitchText>
              </View>
              {detail.cardFees ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <StitchText variant="body-sm" colorKey="textMuted">Card fees</StitchText>
                  <StitchText variant="body-sm" colorKey="text">− {detail.cardFees}</StitchText>
                </View>
              ) : null}
              {detail.cashCommissionDue ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <StitchText variant="body-sm" colorKey="textMuted">Cash commission</StitchText>
                  <StitchText variant="body-sm" colorKey="text">− {detail.cashCommissionDue}</StitchText>
                </View>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: 6,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                }}
              >
                <StitchText variant="label" colorKey="text">Net payout</StitchText>
                <StitchText variant="label" colorKey="primaryContainer">{detail.net}</StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
                {detail.bankTransferLine}
              </StitchText>
            </View>

            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.xs }}>
              PDF generation runs on the merchant web console. From mobile you can email the receipt summary to yourself or any teammate.
            </StitchText>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Email receipt to me"
                onPress={() => {
                  const subject = encodeURIComponent(
                    `Fresh As Ever payout receipt — ${detail.periodTitle}`,
                  );
                  const body = encodeURIComponent(
                    [
                      `Settlement: ${detail.periodTitle}`,
                      detail.ref,
                      '',
                      `Gross:       ${detail.gross}`,
                      `Commission:  -${detail.commission}`,
                      detail.cardFees ? `Card fees:   -${detail.cardFees}` : null,
                      detail.cashCommissionDue
                        ? `Cash comm.:  -${detail.cashCommissionDue}`
                        : null,
                      `Net payout:  ${detail.net}`,
                      '',
                      detail.bankTransferLine,
                      `${detail.bankName} · ${detail.branch} · ${detail.acctMasked}`,
                      '',
                      `Transactions: ${detail.txCount}`,
                      ...detail.transactions
                        .slice(0, 20)
                        .map(
                          (t) =>
                            `  ${t.when} — ${t.item} (${t.orderId}) ${t.share}`,
                        ),
                    ]
                      .filter((line): line is string => line != null)
                      .join('\n'),
                  );
                  Linking.openURL(`mailto:?subject=${subject}&body=${body}`).catch(() => {
                    Alert.alert(
                      'No email client',
                      'No mail app is configured on this device.',
                    );
                  });
                  setReceiptOpen(false);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.primaryContainer,
                  paddingVertical: 12,
                  borderRadius: radii.default,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <StitchIcon name="mail" size={18} colorKey="onPrimary" />
                <StitchText variant="label" colorKey="onPrimary">
                  Email receipt
                </StitchText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open web console"
                onPress={() => {
                  Linking.openURL('https://merchants.freshasever.lk/payouts').catch(() => {
                    Alert.alert(
                      'Unavailable',
                      'The merchant web console is not reachable right now.',
                    );
                  });
                  setReceiptOpen(false);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  paddingVertical: 12,
                  borderRadius: radii.default,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <StitchIcon name="ios_share" size={18} colorKey="textMuted" />
                <StitchText variant="label" colorKey="text">
                  Web console
                </StitchText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </StitchScreen>
  );
}
