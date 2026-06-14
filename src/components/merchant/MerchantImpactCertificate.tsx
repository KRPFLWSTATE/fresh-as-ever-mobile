import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
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
  const { colors, spacing, radii } = useStitchTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        shot: {
          width: 360,
          borderRadius: radii.xl,
          overflow: 'hidden',
          backgroundColor: '#f7f6f2',
          ...stitchAmbientShadow,
        },
        frame: {
          margin: spacing.md,
          padding: spacing.xl,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: colors.primaryContainer,
          gap: spacing.lg,
          minHeight: 440,
        },
        seal: { alignItems: 'center', gap: spacing.sm },
        logoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.full,
          backgroundColor: `${colors.primaryContainer}18`,
        },
        outletBlock: { alignItems: 'center', gap: spacing.xs },
        metrics: { gap: spacing.md },
        metricRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${colors.divider}88`,
        },
      }),
    [colors.divider, colors.primaryContainer, radii.lg, radii.xl, spacing.lg, spacing.md, spacing.sm, spacing.xl],
  );

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={styles.shot}>
      <View style={styles.frame} testID="merchant.impactCertificate">
        <Svg height={120} width="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="certWash" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#01696f" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#da7101" stopOpacity={0.1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="120" fill="url(#certWash)" />
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
            <StitchText variant="label" colorKey="onSurface">
              CO₂ prevented
            </StitchText>
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
          Proud partner in Colombo's food rescue movement
        </StitchText>
      </View>
    </ViewShot>
  );
});
