import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon, StitchSurface, StitchText } from '@/ui/stitch';

export type MerchantImpactHeroProps = {
  co2Kg: number;
  wasteKg: number;
  surplusLabel: string;
  windowLabel: string;
  mealsEquiv: number;
  treesEquiv: number;
};

function useCountUp(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(enabled ? 0 : target);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled || target <= 0) {
      setDisplay(target);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value * target)));
    Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(id);
    };
  }, [anim, enabled, target]);

  return display;
}

export function MerchantImpactHero({
  co2Kg,
  wasteKg,
  surplusLabel,
  windowLabel,
  mealsEquiv,
  treesEquiv,
}: MerchantImpactHeroProps): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const [motionOk, setMotionOk] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setMotionOk(!v));
  }, []);

  const co2Display = useCountUp(co2Kg, motionOk);
  const wasteDisplay = useCountUp(wasteKg, motionOk);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          borderRadius: radii.xl,
          overflow: 'hidden',
          ...stitchAmbientShadow,
        },
        inner: {
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: colors.primaryHighlight,
        },
        headline: { gap: spacing.xs },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
        },
        cell: {
          flexGrow: 1,
          flexBasis: '40%',
          minWidth: 120,
          padding: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: `${colors.divider}99`,
          gap: spacing.xs,
        },
        equiv: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          alignItems: 'center',
        },
      }),
    [colors.divider, colors.primaryHighlight, colors.surface, radii.lg, radii.xl, spacing.lg, spacing.md, spacing.sm, spacing.xs],
  );

  return (
    <StitchSurface elevated style={styles.shell} testID="merchant.impactHero">
      <View style={styles.inner}>
        <View style={styles.headline}>
          <StitchText variant="label-caps" colorKey="primary">
            Your rescue impact · {windowLabel.toLowerCase()}
          </StitchText>
          <StitchText variant="h2" colorKey="primaryContainer">
            Thank you for feeding Colombo, not landfills
          </StitchText>
        </View>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <StitchIcon name="wb_cloudy" size={24} colorKey="accent" />
            <StitchText variant="display" colorKey="accent">
              {co2Display}
            </StitchText>
            <StitchText variant="label" colorKey="onSurface">
              kg CO₂e prevented
            </StitchText>
          </View>
          <View style={styles.cell}>
            <StitchIcon name="inventory_2" size={24} colorKey="primary" />
            <StitchText variant="display" colorKey="primary">
              {wasteDisplay}
            </StitchText>
            <StitchText variant="label" colorKey="onSurface">
              kg food rescued
            </StitchText>
          </View>
          <View style={styles.cell}>
            <StitchIcon name="account_balance_wallet" size={24} colorKey="primary" />
            <StitchText variant="h2" colorKey="primary">
              {surplusLabel}
            </StitchText>
            <StitchText variant="label" colorKey="onSurface">
              surplus recovered
            </StitchText>
          </View>
        </View>
        <View style={styles.equiv}>
          <StitchIcon name="lunch_dining" size={18} colorKey="textMuted" />
          <StitchText variant="body-sm" colorKey="textMuted">
            ≈ {mealsEquiv.toLocaleString()} meals · {treesEquiv} tree-years of CO₂
          </StitchText>
        </View>
      </View>
    </StitchSurface>
  );
}
