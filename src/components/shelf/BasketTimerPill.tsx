import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import {
  basketTimerTone,
  formatBasketCountdown,
  remainingBasketMs,
} from '@/lib/basketTimer';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchText } from '@/ui/stitch';

export type BasketTimerPillProps = {
  startedAtMs: number | null;
  onExpired?: () => void;
};

export function BasketTimerPill({
  startedAtMs,
  onExpired,
}: BasketTimerPillProps): React.ReactElement | null {
  const { colors, spacing, radii } = useStitchTheme();
  const [now, setNow] = useState(Date.now());
  const breathe = useRef(new Animated.Value(0)).current;
  const expiredNotified = useRef(false);

  useEffect(() => {
    if (!startedAtMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  useEffect(() => {
    if (!startedAtMs) return;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    });
  }, [breathe, startedAtMs]);

  const remaining = startedAtMs ? remainingBasketMs(startedAtMs, now) : 0;
  const tone = basketTimerTone(remaining);
  const label = formatBasketCountdown(remaining);

  useEffect(() => {
    if (tone === 'expired' && !expiredNotified.current) {
      expiredNotified.current = true;
      onExpired?.();
    }
    if (tone !== 'expired') expiredNotified.current = false;
  }, [onExpired, tone]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.full,
          borderWidth: 1,
        },
      }),
    [radii.full, spacing.md, spacing.sm, spacing.xs],
  );

  if (!startedAtMs) return null;

  const bg =
    tone === 'expired'
      ? colors.errorContainer
      : tone === 'warm'
        ? colors.accentHighlight
        : colors.primaryHighlight;
  const border =
    tone === 'expired'
      ? colors.error
      : tone === 'warm'
        ? colors.accent
        : colors.primaryContainer;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: bg,
          borderColor: border,
          transform: [
            {
              scale: breathe.interpolate({
                inputRange: [0, 1],
                outputRange: [1, tone === 'warm' ? 1.03 : 1.015],
              }),
            },
          ],
        },
      ]}
      testID={tone === 'expired' ? 'shelf.basketExpiredBanner' : 'shelf.basketTimer'}
    >
      <StitchIcon
        name={tone === 'expired' ? 'refresh' : 'schedule'}
        size={16}
        colorKey={tone === 'expired' ? 'error' : tone === 'warm' ? 'accent' : 'primary'}
      />
      <StitchText
        variant="label"
        colorKey={tone === 'expired' ? 'error' : tone === 'warm' ? 'accent' : 'primary'}
      >
        {tone === 'expired' ? 'Prices refreshed for you' : `Basket holds ${label}`}
      </StitchText>
    </Animated.View>
  );
}
