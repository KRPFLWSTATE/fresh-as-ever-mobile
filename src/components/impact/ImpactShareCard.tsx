import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type ImpactShareCardProps = {
  bagsRescued: number;
  co2SavedKg: number;
  totalSavedRs: number;
  kmEquiv: number;
  treesEquiv: number;
};

export const ImpactShareCard = forwardRef<
  React.ElementRef<typeof ViewShot>,
  ImpactShareCardProps
>(function ImpactShareCard(
  { bagsRescued, co2SavedKg, totalSavedRs, kmEquiv, treesEquiv },
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
          backgroundColor: colors.background,
          ...stitchAmbientShadow,
        },
        inner: {
          padding: spacing.xl,
          gap: spacing.lg,
          minHeight: 420,
        },
        brandRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        hero: {
          borderRadius: radii.lg,
          padding: spacing.lg,
          gap: spacing.sm,
          overflow: 'hidden',
        },
        statRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        statCell: {
          flex: 1,
          alignItems: 'center',
          gap: spacing.xs,
          padding: spacing.sm,
          borderRadius: radii.default,
          backgroundColor: `${colors.surface}CC`,
        },
        footer: {
          alignItems: 'center',
          gap: spacing.xs,
        },
      }),
    [colors.background, colors.surface, radii.lg, radii.default, radii.xl, spacing.lg, spacing.md, spacing.sm, spacing.xl, spacing.xs],
  );

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={styles.shot}>
      <View style={styles.inner} testID="impact.shareCard">
        <View style={styles.brandRow}>
          <StitchIcon name="eco" size={28} colorKey="primaryContainer" />
          <StitchText variant="h2" colorKey="primaryContainer">
            Fresh As Ever
          </StitchText>
        </View>
        <View style={styles.hero}>
          <Svg height={160} width="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="impactWash" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.primaryContainer} stopOpacity={0.35} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0.25} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="160" fill="url(#impactWash)" />
          </Svg>
          <StitchText variant="label-caps" colorKey="textMuted">
            My rescue impact
          </StitchText>
          <StitchText variant="display" colorKey="primary">
            {co2SavedKg} kg CO₂e
          </StitchText>
          <StitchText variant="h3" colorKey="onSurface">
            prevented · {bagsRescued} rescues · Rs. {totalSavedRs.toLocaleString()} saved
          </StitchText>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <StitchIcon name="directions_car" size={24} colorKey="accent" />
            <StitchText variant="h3" colorKey="onSurface">
              {kmEquiv.toLocaleString()} km
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
              not driven
            </StitchText>
          </View>
          <View style={styles.statCell}>
            <StitchIcon name="park" size={24} colorKey="primary" />
            <StitchText variant="h3" colorKey="onSurface">
              {treesEquiv}
            </StitchText>
            <StitchText variant="body-sm" colorKey="textMuted" style={{ textAlign: 'center' }}>
              trees · 10 yrs
            </StitchText>
          </View>
        </View>
        <View style={styles.footer}>
          <StitchText variant="body-sm" colorKey="textMuted">
            Join the rescue — freshasever.lk
          </StitchText>
        </View>
      </View>
    </ViewShot>
  );
});
