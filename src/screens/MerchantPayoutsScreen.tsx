import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
  type ViewStyle,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import {
  useMerchantSettlements,
  type MerchantSettlementRow,
} from '@/hooks/useMerchantSettlements';
import type { RootStackParamList } from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import {
  StitchButton,
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
  const uiStatus: 'processing' | 'paid' =
    lower === 'paid' || lower === 'completed' ? 'paid' : 'processing';
  return {
    id: s.id,
    title:
      uiStatus === 'paid'
        ? `Payout · settled ${ts}`
        : `Payout · ${s.status} window`,
    subtitle: `${s.total_orders.toLocaleString()} orders · Rs ${Math.round(s.gross_sales).toLocaleString()} gross`,
    amount: `Rs ${s.net_payout.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    status: uiStatus,
  };
}

/**
 * Role-gate fallback for non-merchant sessions deep-linking into
 * `freshasever://merchant/payouts`. Mirrors `AdminOnlyNotice`.
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
          Sign in with a merchant account to see payout history for your outlets.
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

export function MerchantPayoutsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { merchant, loading: merchantLoading } = useMerchantContext(env);
  const {
    rows: settlementRows,
    loading: settlementsLoading,
    error: settlementsError,
    refetch: refetchSettlements,
  } = useMerchantSettlements(env, 80);
  const { colors, radii, spacing } = useStitchTheme();
  const [refreshing, setRefreshing] = useState(false);

  const payoutRows = useMemo(
    () => settlementRows.map(settlementToRow),
    [settlementRows],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchSettlements();
    } finally {
      setRefreshing(false);
    }
  }, [refetchSettlements]);

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
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
    const listCard: ViewStyle = { overflow: 'hidden' };
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.md,
      },
      headerBlock: { marginBottom: spacing.sm },
      sectionTitle: { marginBottom: spacing.md },
      listCard,
      cardBorder,
      row,
      iconDisc,
      chipBase,
      err: { color: colors.error },
    };
  }, [colors, radii, spacing]);

  if (!merchantLoading && !merchant) {
    return <MerchantOnlyNotice />;
  }

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
      <View style={styles.headerBlock}>
        <StitchText variant="h1" colorKey="text">
          Payouts
        </StitchText>
        <StitchText variant="body-md" colorKey="textMuted" style={{ marginTop: 4 }}>
          Bank transfers appear here once PayHERE settles.
        </StitchText>
      </View>

      <StitchText variant="h2" colorKey="text" style={styles.sectionTitle}>
        Recent Payouts
      </StitchText>

      {settlementsError ? (
        <StitchText variant="body-sm" style={styles.err}>
          {settlementsError}
        </StitchText>
      ) : null}

      {settlementsLoading && payoutRows.length === 0 ? (
        <ActivityIndicator color={colors.primaryContainer} />
      ) : payoutRows.length === 0 ? (
        <StitchSurface elevated padding="md" style={[styles.cardBorder, styles.listCard]}>
          <StitchText variant="label" colorKey="text">
            No settlements yet
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
            Completed settlement windows from your merchant account will list here automatically.
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
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  flex: 1,
                }}
              >
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
                <StitchText
                  variant="price-original"
                  colorKey="text"
                  style={{ fontWeight: '600' }}
                >
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
        </StitchSurface>
      )}

      <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: spacing.sm }}>
        Full settlement timelines and line items sync from the merchant web console. Use this list
        for quick reference and support tickets.
      </StitchText>
    </StitchScreen>
  );
}
