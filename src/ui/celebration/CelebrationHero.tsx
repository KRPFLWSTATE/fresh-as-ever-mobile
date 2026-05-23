import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  type ViewStyle,
} from 'react-native';
import { StitchIcon } from '@/ui/stitch';
import type { CelebrationVariant } from '@/content/celebrationMoments';
import { useStitchTheme } from '@/theme/StitchThemeContext';

function PulseRing({ color, enabled }: { color: string; enabled: boolean }): React.ReactElement {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    function loop(value: Animated.Value, delay: number) {
      const seq = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      seq.start();
      return seq;
    }
    const s1 = loop(a, 0);
    const s2 = loop(b, 600);
    const s3 = loop(c, 1200);
    return () => {
      s1.stop();
      s2.stop();
      s3.stop();
    };
  }, [a, b, c, enabled]);

  function ringStyle(value: Animated.Value): Animated.WithAnimatedObject<ViewStyle> {
    return {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 2,
      borderColor: color,
      transform: [
        {
          scale: value.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.9],
          }),
        },
      ],
      opacity: value.interpolate({
        inputRange: [0, 1],
        outputRange: [0.45, 0],
      }),
    };
  }

  return (
    <View
      pointerEvents="none"
      style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}
    >
      {enabled ? (
        <>
          <Animated.View style={ringStyle(a)} />
          <Animated.View style={ringStyle(b)} />
          <Animated.View style={ringStyle(c)} />
        </>
      ) : null}
    </View>
  );
}

export type CelebrationHeroProps = {
  variant: CelebrationVariant;
  filledCheck?: boolean;
  reduceMotion?: boolean;
};

export function CelebrationHero({
  variant,
  filledCheck,
  reduceMotion,
}: CelebrationHeroProps): React.ReactElement {
  const { colors } = useStitchTheme();
  const [systemReduceMotion, setSystemReduceMotion] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setSystemReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const motionOff = reduceMotion ?? systemReduceMotion;
  const showPulse = variant === 'rescue' && !motionOff;
  const useFilled = filledCheck ?? variant === 'rescue';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        variant === 'rescue' ? 'Rescue confirmed' : 'Reservation successful'
      }
      style={{ alignItems: 'center', marginBottom: 0 }}
    >
      {showPulse ? <PulseRing color={colors.primaryContainer} enabled /> : null}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primaryHighlight,
          shadowColor: colors.primaryContainer,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: motionOff ? 0.08 : 0.15,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <StitchIcon
          name={useFilled ? 'check_circle' : 'check_circle_outline'}
          size={useFilled ? 56 : 64}
          colorKey={useFilled ? 'primary' : 'primaryContainer'}
        />
      </View>
    </View>
  );
}
