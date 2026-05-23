import React, { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useCustomerImpact } from '@/hooks/useCustomerImpact';
import { useAuthContext } from '@/context/AuthContext';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon } from '@/ui/stitch/StitchIcon';
import { StitchSurface } from '@/ui/stitch/StitchSurface';
import { StitchText } from '@/ui/stitch/StitchText';
import { logError } from '@/observability/logError';

/** Rough equivalents aligned to Stitch demo ratios (~105 kg CO₂ → 400 km / 12k charges / 5 trees). */
function co2Equivalents(co2Kg: number): { km: number; phones: number; trees: number } {
  if (!Number.isFinite(co2Kg) || co2Kg <= 0) {
    return { km: 0, phones: 0, trees: 0 };
  }
  return {
    km: Math.max(0, Math.round(co2Kg / 0.2625)),
    phones: Math.max(0, Math.round(co2Kg / 0.00875)),
    trees: Math.max(0, Math.round(co2Kg / 21)),
  };
}

const BENTO_CARD_MIN_H = 192;

export function ImpactScreen() {
  const { env, user } = useAuthContext();
  const { bagsRescued, co2SavedKg, totalSavedRs, loading, refetch } =
    useCustomerImpact(env, user?.id ?? null);

  const { colors, spacing, radii } = useStitchTheme();
  const equiv = useMemo(() => co2Equivalents(co2SavedKg), [co2SavedKg]);

  useFocusEffect(
    useCallback(() => {
      refetch().catch((err) => logError(err, { context: 'ImpactScreen.focusRefetch' }));
    }, [refetch]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1 },
        pad: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        },
        header: { alignItems: 'center', gap: spacing.sm },
        bento: { gap: spacing.md },
        card: {
          minHeight: BENTO_CARD_MIN_H,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}CC`,
          justifyContent: 'space-between',
        },
        cardTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        iconBubble: {
          padding: spacing.sm,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        metricBlock: { gap: spacing.xs },
        co2Baseline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
        moneyRow: {
          minHeight: 128,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}CC`,
        },
        moneyRowInner: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.md,
          flexWrap: 'wrap',
        },
        moneyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
        equivShell: {
          borderRadius: radii.xl,
          padding: spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}CC`,
          gap: spacing.md,
          ...stitchAmbientShadow,
        },
        equivGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
        },
        equivCell: {
          flexGrow: 1,
          flexBasis: '28%',
          minWidth: 96,
          alignItems: 'center',
          padding: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${colors.divider}99`,
          backgroundColor: colors.surface,
          gap: spacing.xs,
        },
        methodology: { gap: spacing.sm },
        methodologyBody: { gap: spacing.md },
        methodologyRule: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
          paddingBottom: spacing.xs,
        },
        warn: {
          backgroundColor: colors.errorContainer,
          padding: spacing.md,
          borderRadius: radii.lg,
        },
        loader: { marginTop: spacing.lg },
      }),
    [colors.divider, colors.errorContainer, colors.surface, radii.full, radii.lg, radii.xl, spacing],
  );

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.pad}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            refetch().catch((err) => logError(err, { context: 'ImpactScreen.refetch' }));
          }}
        />
      }
    >
      <View style={styles.header}>
        <StitchText variant="h1" colorKey="primary" style={{ textAlign: 'center' }}>
          Your Environmental Impact
        </StitchText>
        <StitchText variant="body-lg" colorKey="textMuted" style={{ textAlign: 'center' }}>
          {
            "Every meal rescued is a step towards a greener planet. Here is the difference you've made."
          }
        </StitchText>
      </View>

      {!user ? (
        <View style={styles.warn}>
          <StitchText variant="body-sm" colorKey="onErrorContainer">
            Sign in to see your rescue footprint.
          </StitchText>
        </View>
      ) : null}

      {loading && !bagsRescued && user ? (
        <ActivityIndicator style={styles.loader} color={colors.primaryContainer} />
      ) : (
        <>
          <View style={styles.bento}>
            <StitchSurface elevated padding="md" style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBubble, { backgroundColor: colors.primaryHighlight }]}>
                  <StitchIcon name="shopping_bag" size={28} colorKey="primary" />
                </View>
                <StitchText variant="label-caps" colorKey="textMuted">
                  LIFETIME
                </StitchText>
              </View>
              <View style={styles.metricBlock}>
                <StitchText variant="display" colorKey="primary">
                  {bagsRescued}
                </StitchText>
                <StitchText variant="h3" colorKey="onSurface">
                  Bags Rescued
                </StitchText>
              </View>
            </StitchSurface>

            <StitchSurface elevated padding="md" style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBubble, { backgroundColor: colors.accentHighlight }]}>
                  <StitchIcon name="wb_cloudy" size={28} colorKey="accent" />
                </View>
                <StitchText variant="label-caps" colorKey="textMuted">
                  ESTIMATED
                </StitchText>
              </View>
              <View style={styles.metricBlock}>
                <View style={styles.co2Baseline}>
                  <StitchText variant="display" colorKey="accent">
                    {co2SavedKg}
                  </StitchText>
                  <StitchText variant="h3" colorKey="accent">
                    kg
                  </StitchText>
                </View>
                <StitchText variant="h3" colorKey="onSurface">
                  CO₂e Prevented
                </StitchText>
              </View>
            </StitchSurface>

            <StitchSurface elevated padding="md" style={styles.moneyRow}>
              <View style={styles.moneyRowInner}>
                <View style={styles.moneyLeft}>
                  <View style={[styles.iconBubble, { backgroundColor: colors.primaryHighlight }]}>
                    <StitchIcon name="account_balance_wallet" size={28} colorKey="primary" />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <StitchText variant="h3" colorKey="onSurface">
                      Money Saved
                    </StitchText>
                    <StitchText variant="body-sm" colorKey="textMuted">
                      Money kept in your pocket
                    </StitchText>
                  </View>
                </View>
                <StitchText variant="display" colorKey="primary">
                  Rs. {totalSavedRs.toLocaleString()}
                </StitchText>
              </View>
            </StitchSurface>
          </View>

          <View style={[styles.equivShell, { backgroundColor: colors.surface2 }]}>
            <StitchText variant="h2" colorKey="primary">
              What does this mean?
            </StitchText>
            <StitchText variant="body-md" colorKey="onSurface">
              Your prevented CO₂ emissions are equivalent to:
            </StitchText>
            <View style={styles.equivGrid}>
              <View style={styles.equivCell}>
                <StitchIcon name="directions_car" size={32} colorKey="textMuted" />
                <StitchText variant="h3" colorKey="onSurface">
                  {equiv.km.toLocaleString()} km
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
                  Driven in a car
                </StitchText>
              </View>
              <View style={styles.equivCell}>
                <StitchIcon name="smartphone" size={32} colorKey="textMuted" />
                <StitchText variant="h3" colorKey="onSurface">
                  {equiv.phones.toLocaleString()}
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
                  Smartphones charged
                </StitchText>
              </View>
              <View style={styles.equivCell}>
                <StitchIcon name="park" size={32} colorKey="textMuted" />
                <StitchText variant="h3" colorKey="onSurface">
                  {equiv.trees}
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
                  Tree seedlings grown for 10 years
                </StitchText>
              </View>
            </View>
          </View>

          <View style={styles.methodology}>
            <View style={styles.methodologyRule}>
              <StitchText variant="h2" colorKey="primary">
                Our Methodology
              </StitchText>
            </View>
            <View style={styles.methodologyBody}>
              <View>
                <StitchText variant="label" colorKey="onSurface" style={{ marginBottom: spacing.xs }}>
                  How we calculate CO₂e
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  We use a standardized conversion factor where 1 kg of rescued food averts
                  approximately 2.5 kg of CO₂ equivalents (CO₂e). This accounts for the emissions saved
                  from preventing food waste in landfills and the energy conserved from agricultural
                  production, transportation, and preparation.
                </StitchText>
              </View>
              <View>
                <StitchText variant="label" colorKey="onSurface" style={{ marginBottom: spacing.xs }}>
                  Bag Weight Estimation
                </StitchText>
                <StitchText variant="body-sm" colorKey="textMuted">
                  {
                    "For simplicity, we estimate that each 'Rescue Bag' contains an average of 1 kg of food. Actual weights may vary depending on the merchant and the specific items rescued."
                  }
                </StitchText>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
