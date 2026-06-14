import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View, type ViewStyle } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useAuthContext } from '@/context/AuthContext';
import {
  useMerchantAnalytics,
  type MerchantAnalyticsSnapshot,
} from '@/hooks/useMerchantAnalytics';
import { useMerchantReviews } from '@/hooks/useMerchantReviews';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { isDemoMode } from '@/config/demoMode';
import {
  ANALYTICS_WINDOW_OPTIONS,
  type AnalyticsWindowKey,
  formatLkr,
} from '@/lib/merchantAnalytics';
import { captureViewShot, shareCardGraphic } from '@/lib/shareCard';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { MerchantImpactHero } from '@/components/merchant/MerchantImpactHero';
import { MerchantImpactCertificate } from '@/components/merchant/MerchantImpactCertificate';
import {
  StitchIcon,
  StitchScreen,
  StitchSurface,
  StitchText,
} from '@/ui/stitch';

const CHART_INNER_HEIGHT = 184;
const HOUR_LABELS = ['12a', '4a', '8a', '12p', '4p', '8p'] as const;
const HOUR_SLICE_STARTS = [0, 4, 8, 12, 16, 20];

function bucketSliceTotals(snapshot: MerchantAnalyticsSnapshot | null): number[] {
  const buckets = snapshot?.hourBuckets ?? [];
  return HOUR_SLICE_STARTS.map((start) => {
    let sum = 0;
    for (let h = start; h < start + 4; h += 1) sum += buckets[h]?.count ?? 0;
    return sum;
  });
}

export function MerchantAnalyticsScreen() {
  const { env } = useAuthContext();
  const { outlets } = useMerchantContext(env);
  const [windowKey, setWindowKey] = useState<AnalyticsWindowKey>(30);
  const { snapshot, loading, error } = useMerchantAnalytics(env, windowKey);
  const { averageRating, reviews, loading: revLoad, error: revErr } =
    useMerchantReviews(env);
  const { colors, radii, spacing } = useStitchTheme();
  const certRef = React.useRef<React.ElementRef<typeof ViewShot>>(null);
  const [sharingCert, setSharingCert] = useState(false);

  const onPickWindow = useCallback(() => {
    Alert.alert('Time range', undefined, [
      ...ANALYTICS_WINDOW_OPTIONS.map((opt) => ({
        text: opt.label,
        onPress: () => setWindowKey(opt.key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }, []);

  const windowLabel = useMemo(
    () => ANALYTICS_WINDOW_OPTIONS.find((o) => o.key === windowKey)?.label ?? 'Last 30 days',
    [windowKey],
  );

  const outletName = outlets[0]?.name ?? 'Your outlet';
  const mealsEquiv = useMemo(
    () => Math.max(0, Math.round((snapshot?.wasteKg ?? 0) * 2.5)),
    [snapshot?.wasteKg],
  );
  const treesEquiv = useMemo(
    () => Math.max(0, Math.round((snapshot?.co2Kg ?? 0) / 21)),
    [snapshot?.co2Kg],
  );

  const onShareCertificate = useCallback(async () => {
    setSharingCert(true);
    try {
      const uri = await captureViewShot(certRef);
      await shareCardGraphic({
        title: `${outletName} impact certificate`,
        message: `Our outlet prevented ${snapshot?.co2Kg ?? 0} kg CO₂e with Fresh As Ever.`,
        imageUri: uri,
      });
    } finally {
      setSharingCert(false);
    }
  }, [outletName, snapshot?.co2Kg]);

  const sliceBars = useMemo(() => bucketSliceTotals(snapshot), [snapshot]);
  const maxBar = useMemo(() => Math.max(1, ...sliceBars), [sliceBars]);
  const peakIdx = useMemo(
    () => sliceBars.reduce((best, v, i) => (v > sliceBars[best] ? i : best), 0),
    [sliceBars],
  );

  const avgLabel =
    reviews.length > 0 ? averageRating.toFixed(1) : 'No reviews yet';

  const styles = useMemo(() => {
    const pagePad = spacing.pageMarginMobile;
    const cardBorder: ViewStyle = {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    };
    return {
      content: {
        paddingHorizontal: pagePad,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        flexWrap: 'wrap',
      } as ViewStyle,
      filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.default,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
      } as ViewStyle,
      kpiGrid: { gap: spacing.md } as ViewStyle,
      kpiCard: {
        borderRadius: radii.lg,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
      } as ViewStyle,
      cardBorder,
      chartShell: { marginTop: spacing.md, height: 220, position: 'relative' } as ViewStyle,
      chartBarsRow: {
        position: 'absolute',
        left: 36,
        right: 0,
        top: 0,
        bottom: 28,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
      } as ViewStyle,
      dayLabelsRow: {
        position: 'absolute',
        left: 36,
        right: 0,
        bottom: 0,
        height: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
      } as ViewStyle,
      twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } as ViewStyle,
      chartCol: { flex: 1, minWidth: 280 } as ViewStyle,
      listCol: { flex: 1, minWidth: 260 } as ViewStyle,
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
      <View style={styles.headerRow}>
        <StitchText variant="h1" colorKey="text">
          Analytics
        </StitchText>
        <Pressable
          accessibilityRole="button"
          onPress={onPickWindow}
          style={({ pressed }) => [styles.filterChip, { opacity: pressed ? 0.88 : 1 }]}
        >
          <StitchIcon name="calendar_month" size={16} colorKey="text" />
          <StitchText variant="label" colorKey="text">
            {windowLabel}
          </StitchText>
          <StitchIcon name="expand_more" size={16} colorKey="textMuted" />
        </Pressable>
      </View>

      {loading || revLoad ? <ActivityIndicator color={colors.primaryContainer} /> : null}
      {error ? (
        <StitchText variant="body-md" colorKey="error">
          {error}
        </StitchText>
      ) : null}
      {revErr ? (
        <StitchText variant="body-md" colorKey="error">
          {revErr}
        </StitchText>
      ) : null}

      <MerchantImpactHero
        co2Kg={snapshot?.co2Kg ?? 0}
        wasteKg={snapshot?.wasteKg ?? 0}
        surplusLabel={snapshot?.surplusRecoveredLabel ?? formatLkr(0)}
        windowLabel={windowLabel}
        mealsEquiv={mealsEquiv}
        treesEquiv={treesEquiv}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share impact certificate"
        testID="merchant.certificateShare"
        onPress={() => void onShareCertificate()}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          opacity: pressed || sharingCert ? 0.85 : 1,
        })}
      >
        <StitchIcon name="share" size={20} colorKey="primary" />
        <StitchText variant="label" colorKey="primary">
          {sharingCert ? 'Preparing certificate…' : 'Share impact certificate'}
        </StitchText>
      </Pressable>

      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <MerchantImpactCertificate
          ref={certRef}
          outletName={outletName}
          windowLabel={windowLabel}
          co2Kg={snapshot?.co2Kg ?? 0}
          wasteKg={snapshot?.wasteKg ?? 0}
          surplusLabel={snapshot?.surplusRecoveredLabel ?? formatLkr(0)}
        />
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Revenue ({windowLabel.toLowerCase()})
          </StitchText>
          <StitchText variant="h2" colorKey="text" style={{ marginTop: 4 }}>
            {snapshot?.revenueLabel ?? formatLkr(0)}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 8 }}>
            Collected & completed orders only
          </StitchText>
        </View>

        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Surplus recovered ({windowLabel.toLowerCase()})
          </StitchText>
          <StitchText variant="h2" colorKey="accent" style={{ marginTop: 4 }}>
            {snapshot?.surplusRecoveredLabel ?? formatLkr(0)}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 8 }}>
            Retail value of food rescued from waste
          </StitchText>
        </View>

        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Waste prevented
          </StitchText>
          <StitchText variant="h2" colorKey="text" style={{ marginTop: 4 }}>
            {snapshot?.wasteKg ?? 0} kg
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 8 }}>
            Est. from bag weight × orders
          </StitchText>
        </View>

        <View style={styles.kpiCard}>
          <StitchText variant="label-caps" colorKey="textMuted">
            Customer reach
          </StitchText>
          <StitchText variant="h2" colorKey="text" style={{ marginTop: 4 }}>
            {(snapshot?.customerReach ?? 0).toLocaleString()}
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 8 }}>
            Unique customers in window
          </StitchText>
        </View>
      </View>

      <View style={styles.twoCol}>
        <StitchSurface elevated padding="md" style={[styles.cardBorder, styles.chartCol]}>
          <StitchText variant="h3" colorKey="text">
            Popular times
          </StitchText>
          <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 2 }}>
            Orders by hour · peak {snapshot?.peakHour ?? '—'} · {windowLabel.toLowerCase()}
          </StitchText>
          <View style={styles.chartShell}>
            <View style={styles.chartBarsRow}>
              {sliceBars.map((v, i) => {
                const frac = v / maxBar;
                return (
                  <View
                    key={HOUR_LABELS[i]}
                    style={{
                      width: 14,
                      height: Math.max(8, Math.round(frac * CHART_INNER_HEIGHT)),
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor:
                        i === peakIdx && v > 0
                          ? colors.primaryContainer
                          : colors.surfaceContainerHigh,
                    }}
                  />
                );
              })}
            </View>
            <View style={styles.dayLabelsRow}>
              {HOUR_LABELS.map((d) => (
                <StitchText key={d} variant="body-sm" colorKey="textFaint" style={{ fontSize: 11 }}>
                  {d}
                </StitchText>
              ))}
            </View>
          </View>
        </StitchSurface>

        <StitchSurface elevated padding="md" style={[styles.cardBorder, styles.listCol]}>
          <StitchText variant="h3" colorKey="text" style={{ marginBottom: spacing.md }}>
            Top selling bags
          </StitchText>
          <View style={{ gap: spacing.md }}>
            {(snapshot?.topBags ?? []).length === 0 ? (
              <StitchText variant="body-sm" colorKey="textMuted">
                {isDemoMode()
                  ? 'Demo mode: no collected orders in this window.'
                  : 'No collected orders in this window yet.'}
              </StitchText>
            ) : (
              (snapshot?.topBags ?? []).map((row) => (
                <View
                  key={row.bagId}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <StitchText variant="label" colorKey="text" numberOfLines={1}>
                      {row.title}
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      {row.units} sold · {formatLkr(row.revenue)}
                    </StitchText>
                  </View>
                </View>
              ))
            )}
          </View>
        </StitchSurface>
      </View>

      <StitchSurface elevated padding="md" style={styles.cardBorder}>
        <StitchText variant="h3" colorKey="text">
          Recent reviews
        </StitchText>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 4 }}>
          {avgLabel} · {reviews.length} loaded
        </StitchText>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {reviews.length === 0 ? (
            <StitchText variant="body-md" colorKey="textMuted">
              No reviews yet for this outlet.
            </StitchText>
          ) : (
            reviews.slice(0, 4).map((r, idx, arr) => (
              <View
                key={r.id}
                style={{
                  paddingBottom: spacing.md,
                  borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                  <StitchText variant="label" colorKey="text" numberOfLines={1}>
                    {r.customerName}
                  </StitchText>
                  <StitchText variant="label" colorKey="primaryContainer">
                    {r.rating.toFixed(1)}
                  </StitchText>
                </View>
                {r.comment ? (
                  <StitchText variant="body-sm" colorKey="textMuted" numberOfLines={3} style={{ marginTop: 4 }}>
                    {r.comment}
                  </StitchText>
                ) : null}
              </View>
            ))
          )}
        </View>
      </StitchSurface>
    </StitchScreen>
  );
}
