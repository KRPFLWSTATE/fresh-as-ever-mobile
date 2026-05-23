import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

const PAGE_SIZE = 20;

type TxRow = {
  id: string;
  code: string;
  when: string | null;
  item: string;
  total: number;
  fee: number;
  share: number;
  status: string;
};

/**
 * Paginated full transaction list for a settled / pending merchant payout. Reached from
 * `MerchantPayoutDetail` → **View all transactions**. Lives on `RootStack` so deep links
 * (`freshasever://merchant/payouts/:settlementId/transactions`) target the right level.
 */
export function MerchantPayoutTransactionsScreen(): React.ReactElement {
  const route =
    useRoute<RouteProp<RootStackParamList, 'MerchantPayoutTransactions'>>();
  const settlementId = route.params?.settlementId ?? '';
  const { env } = useAuthContext();
  const { merchant, outlets, loading: ctxLoading } = useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();
  const merchantId = merchant?.id ? String(merchant.id) : '';
  const outletIds = useMemo(() => outlets.map((o) => String(o.id)), [outlets]);

  const [settlementMeta, setSettlementMeta] = useState<{
    periodLabel: string;
    status: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settlementWindow = useMemo(
    () => ({ start: null as string | null, end: null as string | null }),
    [],
  );

  const styles = useMemo(() => {
    const card: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radii.lg,
      overflow: 'hidden',
    };
    const header: ViewStyle = {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.surfaceBright,
    };
    const row: ViewStyle = {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    };
    return {
      pad: {
        paddingHorizontal: spacing.pageMarginMobile,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.md,
      },
      card,
      header,
      row,
      cell: { flex: 1, minWidth: 0 } as const,
      cellRight: { flex: 1, textAlign: 'right' as const },
      pagerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginTop: spacing.sm,
      } as ViewStyle,
      pagerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: radii.default,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
      } as ViewStyle,
    };
  }, [colors, radii, spacing]);

  const formatLkr = useCallback(
    (n: number) =>
      `Rs ${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    [],
  );

  const load = useCallback(async () => {
    if (!settlementId) {
      setError('Missing settlement id.');
      setLoading(false);
      return;
    }
    if (ctxLoading) return;

    setLoading(true);
    setError(null);
    const sb = getSupabase(env);

    // 1) Pin the settlement window + status + ownership.
    const settlementRes = await sb
      .from('settlements')
      .select(
        'id, status, created_at, period_start, period_end, merchant_id',
      )
      .eq('id', settlementId)
      .maybeSingle();

    if (settlementRes.error || !settlementRes.data) {
      setError(
        settlementRes.error?.message ?? 'Settlement not found (or blocked by RLS).',
      );
      setLoading(false);
      return;
    }
    const settlement = settlementRes.data as Record<string, unknown>;
    const merchantOfRow = String(settlement.merchant_id ?? '');
    if (merchantId && merchantOfRow && merchantOfRow !== merchantId) {
      setError('Payout does not belong to your account.');
      setLoading(false);
      return;
    }

    const periodStart =
      typeof settlement.period_start === 'string'
        ? (settlement.period_start as string)
        : null;
    const periodEnd =
      typeof settlement.period_end === 'string'
        ? (settlement.period_end as string)
        : null;
    const createdAt =
      typeof settlement.created_at === 'string'
        ? (settlement.created_at as string)
        : null;
    const startIso =
      periodStart ??
      (createdAt
        ? new Date(new Date(createdAt).getTime() - 7 * 24 * 3600 * 1000).toISOString()
        : new Date(0).toISOString());
    const endIso = periodEnd ?? createdAt ?? new Date().toISOString();
    settlementWindow.start = startIso;
    settlementWindow.end = endIso;

    const fmtDate = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—';
    const periodLabel =
      periodStart && periodEnd
        ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
        : `Settled ${fmtDate(createdAt)}`;
    setSettlementMeta({
      periodLabel,
      status: String(settlement.status ?? 'pending'),
    });

    // 2) Paginate orders settled in this window.
    if (outletIds.length === 0) {
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const ordersRes = await sb
      .from('orders')
      .select(
        'id, reservation_code, total, platform_fee, order_status, collected_at, created_at, outlet_id, bag_id',
        { count: 'exact' },
      )
      .in('outlet_id', outletIds)
      .in('order_status', ['collected', 'completed'])
      .gte('collected_at', startIso)
      .lte('collected_at', endIso)
      .order('collected_at', { ascending: false })
      .range(from, to);

    if (ordersRes.error) {
      setError(ordersRes.error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const orderRows = (ordersRes.data ?? []) as Record<string, unknown>[];
    const bagIds = Array.from(
      new Set(
        orderRows.map((o) => String(o.bag_id ?? '')).filter((id) => id.length > 0),
      ),
    );
    let bagTitleById: Record<string, string> = {};
    if (bagIds.length > 0) {
      const { data: bagData } = await sb
        .from('rescue_bags')
        .select('id, title')
        .in('id', bagIds);
      ((bagData ?? []) as Record<string, unknown>[]).forEach((b) => {
        bagTitleById[String(b.id ?? '')] = String(b.title ?? '') || 'Rescue bag';
      });
    }

    const mapped: TxRow[] = orderRows.map((o) => {
      const ts =
        typeof o.collected_at === 'string'
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
      const code = String(
        o.reservation_code ?? String(o.id ?? '').slice(0, 6).toUpperCase(),
      );
      const total = Number(o.total ?? 0);
      const fee = Number(o.platform_fee ?? 0);
      return {
        id: String(o.id ?? ''),
        code: `#${code}`,
        when,
        item,
        total,
        fee,
        share: total - fee,
        status: String(o.order_status ?? '').toLowerCase(),
      };
    });
    setRows(mapped);
    if (typeof ordersRes.count === 'number') setTotalCount(ordersRes.count);
    setLoading(false);
  }, [env, settlementId, page, ctxLoading, merchantId, outletIds, settlementWindow]);

  useEffect(() => {
    load().catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not load transactions.');
      setLoading(false);
    });
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * PAGE_SIZE);

  return (
    <StitchScreen
      scroll
      scrollProps={{ contentContainerStyle: styles.pad, keyboardShouldPersistTaps: 'handled' }}
    >
      <View>
        <StitchText variant="h1" colorKey="text">
          All transactions
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          {settlementMeta?.periodLabel ?? 'Settlement period'}
          {settlementMeta?.status ? ` · ${settlementMeta.status}` : ''}
        </StitchText>
      </View>

      {error ? (
        <StitchSurface
          elevated
          padding="md"
          style={{ borderWidth: 1, borderColor: colors.error, backgroundColor: colors.errorContainer }}
        >
          <StitchText variant="body-sm" colorKey="error">
            {error}
          </StitchText>
        </StitchSurface>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} style={{ marginTop: spacing.lg }} />
      ) : (
        <StitchSurface elevated padding="none" style={styles.card}>
          <View style={styles.header}>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.cell}>
              When · Order
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.cell}>
              Item
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted" style={styles.cellRight}>
              Your share
            </StitchText>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={{ padding: spacing.md }}>
                <StitchText variant="body-md" colorKey="textMuted">
                  No transactions for this settlement window.
                </StitchText>
              </View>
            }
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.row,
                  index === rows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.cell}>
                  <StitchText variant="body-sm" colorKey="text" numberOfLines={1}>
                    {item.when}
                  </StitchText>
                  <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={1}>
                    {item.code}
                  </StitchText>
                </View>
                <StitchText
                  variant="body-sm"
                  colorKey="text"
                  style={styles.cell}
                  numberOfLines={2}
                >
                  {item.item}
                </StitchText>
                <StitchText variant="body-sm" colorKey="text" style={styles.cellRight}>
                  {formatLkr(item.share)}
                </StitchText>
              </View>
            )}
          />
          <View
            style={{
              padding: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <StitchText variant="label-caps" colorKey="textMuted">
              {rows.length === 0
                ? 'No rows'
                : `Showing ${rangeStart}-${rangeEnd} of ${totalCount.toLocaleString()}`}
            </StitchText>
            <StitchText variant="label-caps" colorKey="textMuted">
              Page {page} of {totalPages}
            </StitchText>
          </View>
        </StitchSurface>
      )}

      <View style={styles.pagerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={[
            styles.pagerBtn,
            (page <= 1 || loading) && { opacity: 0.5 },
          ]}
        >
          <StitchIcon name="chevron_left" size={16} colorKey="textMuted" />
          <StitchText variant="label" colorKey="textMuted">
            Previous
          </StitchText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next page"
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          style={[
            styles.pagerBtn,
            (page >= totalPages || loading) && { opacity: 0.5 },
          ]}
        >
          <StitchText variant="label" colorKey="textMuted">
            Next
          </StitchText>
          <StitchIcon name="chevron_right" size={16} colorKey="textMuted" />
        </Pressable>
      </View>
    </StitchScreen>
  );
}
