import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import { StitchIcon, StitchText } from '@/ui/stitch';
import type { ReservationCartBag } from '@/hooks/useReservationCart';

export type GroupReservationCartBarProps = {
  bags: ReservationCartBag[];
  visible: boolean;
  onPress: () => void;
  testID?: string;
};

export function GroupReservationCartBar({
  bags,
  visible,
  onPress,
  testID = 'group.cartBar',
}: GroupReservationCartBarProps): React.ReactElement | null {
  const { colors, spacing, radii } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(bags.length);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      Animated.spring(slide, {
        toValue: visible ? 1 : 0,
        friction: reduce ? 20 : 6,
        tension: reduce ? 200 : 80,
        useNativeDriver: true,
      }).start();
    });
  }, [slide, visible]);

  useEffect(() => {
    if (bags.length > prevCount.current) {
      Animated.sequence([
        Animated.spring(bounce, { toValue: 1.08, friction: 4, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();
    }
    prevCount.current = bags.length;
  }, [bags.length, bounce]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: insets.bottom + spacing.md,
          zIndex: 40,
        },
        bar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: colors.primaryContainer,
          ...stitchAmbientShadow,
        },
        chip: {
          minWidth: 28,
          height: 28,
          borderRadius: 14,
          paddingHorizontal: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent,
        },
        copy: { flex: 1, gap: 2 },
      }),
    [colors.accent, colors.primaryContainer, insets.bottom, radii.xl, spacing.lg, spacing.md, spacing.sm],
  );

  if (!visible && bags.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: slide,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [120, 0],
              }),
            },
            { scale: bounce },
          ],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Group cart, ${bags.length} bags`}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.bar, { opacity: pressed ? 0.92 : 1 }]}
      >
        <View style={styles.chip}>
          <StitchText variant="label" colorKey="onPrimary">
            {bags.length}
          </StitchText>
        </View>
        <View style={styles.copy}>
          <StitchText variant="label" colorKey="onPrimary">
            {bags.length === 1 ? '1 bag reserved' : `${bags.length} bags in your group`}
          </StitchText>
          <StitchText variant="body-sm" colorKey="onPrimary" style={{ opacity: 0.85 }}>
            One pickup code · tap to checkout
          </StitchText>
        </View>
        <StitchIcon name="shopping_bag" size={24} colorKey="onPrimary" />
      </Pressable>
    </Animated.View>
  );
}
