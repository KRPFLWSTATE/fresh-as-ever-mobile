import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { KG_CO2E_PER_KG_FOOD } from '@/lib/co2Impact';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type MerchantImpactCertificateProps = {
  outletName: string;
  outletAddress?: string | null;
  windowLabel: string;
  co2Kg: number;
  wasteKg: number;
  surplusLabel: string;
};

export const MerchantImpactCertificate = forwardRef<
  React.ElementRef<typeof ViewShot>,
  MerchantImpactCertificateProps
>(function MerchantImpactCertificate(
  { outletName, outletAddress, windowLabel, co2Kg, wasteKg, surplusLabel },
  ref,
) {
  const { colors, spacing, radii, mode } = useStitchTheme();
  const canvasBg = mode === 'dark' ? colors.surface : '#f7f6f2';
  const frameBg = mode === 'dark' ? colors.surfaceContainerLow : colors.surface;
  const co2Breakdown =
    wasteKg > 0 && co2Kg > 0
      ? `${wasteKg} kg food × ${KG_CO2E_PER_KG_FOOD} ≈ ${co2Kg} kg CO₂e`
      : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shot: {
          width: 360,
          borderRadius: radii.xl,
          overflow: 'hidden',
          backgroundColor: canvasBg,
          ...stitchAmbientShadow,
        },
        frame: {
          margin: spacing.md,
          padding: spacing.xl,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: colors.primaryContainer,
          gap: spacing.lg,
          minHeight: 480,
          backgroundColor: frameBg,
        },
        seal: { alignItems: 'center', gap: spacing.sm },
        logoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radii.full,
          backgroundColor: `${colors.primaryContainer}${mode === 'dark' ? '33' : '18'}`,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.divider,
          marginVertical: spacing.xs,
        },
        outletBlock: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
        metrics: { gap: spacing.sm },
        metricRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}88`,
          gap: spacing.md,
        },
        metricCopy: { flex: 1, gap: 2 },
        corner: { position: 'absolute', opacity: 0.35 },
      }),
    [
      canvasBg,
      colors.divider,
      colors.primaryContainer,
      frameBg,
      mode,
      radii.full,
      radii.lg,
      radii.xl,
      spacing.lg,
      spacing.md,
      spacing.sm,
      spacing.xl,
      spacing.xs,
    ],
  );

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={styles.shot}>
      <View style={styles.frame} testID="merchant.impactCertificate">
        <Svg height={140} width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="certWash" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primaryContainer} stopOpacity={mode === 'dark' ? 0.2 : 0.12} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={mode === 'dark' ? 0.16 : 0.1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="140" fill="url(#certWash)" />
          <Circle cx="320" cy="24" r="48" fill={colors.primaryHighlight} opacity={0.5} />
          <Circle cx="28" cy="110" r="36" fill={colors.accentHighlight} opacity={0.45} />
        </Svg>
        <View style={styles.seal}>
          <View style={styles.logoRow}>
            <StitchIcon name="eco" size={28} colorKey="primaryContainer" />
            <StitchText variant="label-caps" colorKey="primary">
              Fresh As Ever
            </StitchText>
          </View>
          <StitchText variant="label-caps" colorKey="textMuted">
            Impact Certificate
          </StitchText>
          <View style={styles.divider} />
          <View style={styles.outletBlock}>
            <StitchText variant="h2" colorKey="primaryContainer" style={{ textAlign: 'center' }}>
              {outletName}
            </StitchText>
            {outletAddress?.trim() ? (
              <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
                {outletAddress.trim()}
              </StitchText>
            ) : null}
          </View>
          <StitchText variant="body-sm" colorKey="textMuted">
            {windowLabel}
          </StitchText>
        </View>
        <View style={styles.metrics}>
          <View style={styles.metricRow}>
            <View style={styles.metricCopy}>
              <StitchText variant="label" colorKey="onSurface">
                Estimated CO₂e prevented
              </StitchText>
              {co2Breakdown ? (
                <StitchText variant="body-sm" colorKey="textMuted">
                  {co2Breakdown}
                </StitchText>
              ) : null}
            </View>
            <StitchText variant="h3" colorKey="accent">
              {co2Kg} kg
            </StitchText>
          </View>
          <View style={styles.metricRow}>
            <StitchText variant="label" colorKey="onSurface">
              Food rescued
            </StitchText>
            <StitchText variant="h3" colorKey="primary">
              {wasteKg} kg
            </StitchText>
          </View>
          <View style={styles.metricRow}>
            <StitchText variant="label" colorKey="onSurface">
              Surplus recovered
            </StitchText>
            <StitchText variant="h3" colorKey="primary">
              {surplusLabel}
            </StitchText>
          </View>
        </View>
        <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
          Proud partner in Colombo&apos;s food rescue movement
        </StitchText>
      </View>
    </ViewShot>
  );
});
