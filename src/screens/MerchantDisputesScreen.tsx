import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  View,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { getSupabase } from '@/lib/supabase';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { logError } from '@/observability/logError';
import {
  StitchButton,
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

type MerchantComplaintRow = {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAtLabel: string;
  orderLabel: string;
  reporterName: string;
};

/**
 * Role-gate fallback rendered when a non-merchant deep-links into this screen
 * (`freshasever://merchant/disputes`).
 */
function MerchantOnlyNotice(): React.ReactElement {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { spacing } = useStitchTheme();
  return (
    <StitchScreen
      scroll
      scrollProps={{ contentContainerStyle: { padding: spacing.pageMarginMobile } }}
    >
      <StitchSurface elevated padding="md">
        <StitchText variant="h3" colorKey="text">
          Only merchants can view this
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 8 }}>
          Sign in with a merchant account to manage disputes for your outlets.
        </StitchText>
        <View style={{ marginTop: spacing.md }}>
          <StitchButton
            title="Back to customer home"
            variant="primary"
            onPress={() => navigation.navigate('MainTabs', { screen: 'DiscoverTab' })}
          />
        </View>
      </StitchSurface>
    </StitchScreen>
  );
}

function mapComplaintRow(r: Record<string, unknown>): MerchantComplaintRow {
  const order = r.order as Record<string, unknown> | undefined;
  const reporter = r.reporter as Record<string, unknown> | undefined;
  const code = String(order?.reservation_code ?? '').trim();
  const created =
    typeof r.created_at === 'string'
      ? new Date(r.created_at as string).toLocaleString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
  return {
    id: String(r.id ?? ''),
    type: String(r.type ?? 'Complaint'),
    description: String(r.description ?? '').trim() || '—',
    status: String(r.status ?? 'open'),
    createdAtLabel: created,
    orderLabel: code ? `Order #${code}` : `Order ${String(r.id ?? '').slice(0, 8)}`,
    reporterName:
      String(reporter?.full_name ?? '').trim() || 'Customer',
  };
}

export function MerchantDisputesScreen() {
  const { env } = useAuthContext();
  const { merchant, outletScopeIds, loading: merchantLoading } = useMerchantContext(env);
  const { colors, radii, spacing } = useStitchTheme();
  const [rows, setRows] = useState<MerchantComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (outletScopeIds.length === 0) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const sb = getSupabase(env);
    const scope = new Set(outletScopeIds);
    const [complaintsRes, disputedOrdersRes] = await Promise.all([
      sb
        .from('complaints')
        .select(
          `
        id,
        type,
        description,
        status,
        created_at,
        reporter:profiles!complaints_reporter_id_fkey(full_name),
        order:orders(reservation_code, outlet_id)
      `,
        )
        .order('created_at', { ascending: false })
        .limit(100),
      sb
        .from('orders')
        .select('id, reservation_code, outlet_id, order_status, created_at')
        .in('outlet_id', [...outletScopeIds])
        .eq('order_status', 'disputed')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (complaintsRes.error) {
      setError(complaintsRes.error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const filtered = ((complaintsRes.data ?? []) as Record<string, unknown>[])
      .filter((raw) => {
        const order = raw.order as { outlet_id?: string } | undefined;
        const oid = order?.outlet_id != null ? String(order.outlet_id) : '';
        return oid && scope.has(oid);
      })
      .map(mapComplaintRow);

    const complaintOrderLabels = new Set(
      filtered.map((r) => r.orderLabel),
    );

    const disputedExtras = ((disputedOrdersRes.data ?? []) as Record<string, unknown>[])
      .map((o) => {
        const code = String(o.reservation_code ?? '').trim();
        const orderLabel = code
          ? `Order #${code}`
          : `Order ${String(o.id ?? '').slice(0, 8)}`;
        const created =
          typeof o.created_at === 'string'
            ? new Date(o.created_at as string).toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—';
        return {
          id: `disputed-order-${String(o.id)}`,
          type: 'Order disputed',
          description:
            'This order is marked disputed on the platform. A complaint record is linked automatically when status changes.',
          status: 'open',
          createdAtLabel: created,
          orderLabel,
          reporterName: 'Platform',
        } satisfies MerchantComplaintRow;
      })
      .filter((row) => !complaintOrderLabels.has(row.orderLabel));

    setRows([...filtered, ...disputedExtras]);
    setLoading(false);
  }, [env, outletScopeIds]);

  useEffect(() => {
    if (merchantLoading) return;
    load().catch((err) => logError(err, { context: 'MerchantDisputesScreen.load' }));
  }, [merchantLoading, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.surfaceContainer,
      borderRadius: radii.xl,
    };
    const chipRow: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
      marginBottom: spacing.sm,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.md,
      },
      cardBorder,
      chipRow,
      err: { color: colors.error },
    };
  }, [colors, radii, spacing]);

  if (!merchantLoading && !merchant) {
    return <MerchantOnlyNotice />;
  }

  const statusLower = (s: string) => s.trim().toLowerCase();
  const isOpen = (s: string) => !['resolved', 'closed'].includes(statusLower(s));

  return (
    <StitchScreen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
        keyboardShouldPersistTaps: 'handled',
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        ),
      }}
    >
      <StitchText variant="h1" colorKey="text">
        Disputes
      </StitchText>
      <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
        Customer complaints linked to orders at your outlets (from the platform complaints table).
      </StitchText>

      {error ? (
        <StitchText variant="body-sm" style={styles.err}>
          {error}
        </StitchText>
      ) : null}

      {loading && rows.length === 0 ? (
        <ActivityIndicator color={colors.primaryContainer} style={{ marginTop: spacing.lg }} />
      ) : rows.length === 0 ? (
        <StitchSurface elevated padding="lg" style={styles.cardBorder}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <StitchIcon name="check_circle_outline" size={56} colorKey="success" />
            <StitchText variant="h3" colorKey="text" style={{ textAlign: 'center' }}>
              No complaints for your outlets
            </StitchText>
            <StitchText variant="body-md" colorKey="textMuted" style={{ textAlign: 'center' }}>
              When customers open a complaint on an order at one of your outlets, it will appear
              here automatically.
            </StitchText>
          </View>
        </StitchSurface>
      ) : (
        rows.map((row) => (
          <StitchSurface key={row.id} elevated padding="md" style={styles.cardBorder}>
            <View style={styles.chipRow}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: isOpen(row.status)
                    ? colors.errorContainer
                    : colors.surfaceContainerHighest,
                }}
              >
                <StitchIcon
                  name={isOpen(row.status) ? 'error' : 'check_circle'}
                  size={14}
                  colorKey={isOpen(row.status) ? 'onErrorContainer' : 'textMuted'}
                />
                <StitchText
                  variant="label-caps"
                  colorKey={isOpen(row.status) ? 'onErrorContainer' : 'textMuted'}
                >
                  {row.type}
                </StitchText>
              </View>
              <StitchText variant="body-sm" colorKey="textMuted">
                {row.orderLabel}
              </StitchText>
            </View>
            <StitchText variant="label" colorKey="textMuted">
              Status: {row.status}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
              {row.createdAtLabel} · {row.reporterName}
            </StitchText>
            <StitchText variant="body-md" colorKey="text" style={{ marginTop: spacing.md }}>
              {row.description}
            </StitchText>
          </StitchSurface>
        ))
      )}
    </StitchScreen>
  );
}
