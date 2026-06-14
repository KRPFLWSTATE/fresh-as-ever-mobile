import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchText } from '@/ui/stitch';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type WeeklyStreakRingProps = {
  count: number;
  goal: number;
  goalMet: boolean;
  remaining: number;
  progress: number;
  compact?: boolean;
};

export function WeeklyStreakRing({
  count,
  goal,
  goalMet,
  remaining,
  progress,
  compact = false,
}: WeeklyStreakRingProps): React.ReactElement {
  const { colors, spacing, radii } = useStitchTheme();
  const size = compact ? 72 : 120;
  const stroke = compact ? 6 : 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const anim = useRef(new Animated.Value(0)).current;
  const flourish = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(progress);
      flourish.setValue(goalMet ? 1 : 0);
      return;
    }
    Animated.spring(anim, {
      toValue: progress,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
    if (goalMet) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(flourish, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(flourish, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [anim, flourish, goalMet, progress, reduceMotion]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          alignItems: 'center',
          gap: compact ? spacing.xs : spacing.sm,
        },
        ringWrap: {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        center: {
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        },
        badge: {
          marginTop: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radii.full,
          backgroundColor: goalMet ? colors.accentHighlight : colors.primaryHighlight,
        },
      }),
    [
      colors.accentHighlight,
      colors.primaryHighlight,
      compact,
      goalMet,
      radii.full,
      size,
      spacing.md,
      spacing.sm,
      spacing.xs,
    ],
  );

  return (
    <View style={styles.shell} testID="impact.weeklyStreak">
      <Animated.View
        style={[
          styles.ringWrap,
          goalMet && !reduceMotion
            ? { transform: [{ scale: flourish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }
            : null,
        ]}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="streakGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primaryContainer} />
              <Stop offset="1" stopColor={goalMet ? colors.accent : colors.primary} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`${colors.divider}99`}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#streakGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.center}>
          {goalMet ? (
            <StitchIcon name="eco" size={compact ? 22 : 32} colorKey="accent" />
          ) : (
            <>
              <StitchText variant={compact ? 'h3' : 'display'} colorKey="primary">
                {count}
              </StitchText>
              <StitchText variant="label-caps" colorKey="textMuted">
                / {goal}
              </StitchText>
            </>
          )}
        </View>
      </Animated.View>
      <StitchText variant={compact ? 'body-sm' : 'h3'} colorKey="onSurface" style={{ textAlign: 'center' }}>
        {goalMet ? 'Weekly goal met!' : `${remaining} rescue${remaining === 1 ? '' : 's'} to go this week`}
      </StitchText>
      {!compact ? (
        <View style={styles.badge}>
          <StitchText variant="label-caps" colorKey={goalMet ? 'accent' : 'primary'}>
            Weekly rescue streak
          </StitchText>
        </View>
      ) : null}
    </View>
  );
}
