import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export type MapPanAmbienceProps = {
  /** True while the user is actively dragging the map. */
  panning: boolean;
  /** Increment to trigger a settle pulse after a gesture pan ends. */
  panSettleToken: number;
  /** Map chrome parallax offset (count chip, control rail). */
  parallax: Animated.Value;
  children?: React.ReactNode;
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

/**
 * Subtle map-only depth during pan — a soft radial vignette that breathes in
 * while exploring and eases out after release, plus a shared parallax value
 * for floating chrome. Does not touch feed cards or header chrome.
 */
export function MapPanAmbience({
  panning,
  panSettleToken,
  parallax,
  children,
}: MapPanAmbienceProps): React.ReactElement {
  const vignette = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!panning) return;
    Animated.timing(vignette, {
      toValue: 0.42,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(parallax, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [panning, parallax, vignette]);

  useEffect(() => {
    if (panSettleToken === 0) return;
    Animated.sequence([
      Animated.timing(vignette, {
        toValue: 0.55,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(vignette, {
        toValue: 0,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.spring(parallax, {
      toValue: 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [panSettleToken, parallax, vignette]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: vignette }]}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="panVignette" cx="50%" cy="42%" rx="68%" ry="58%">
                <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
                <Stop offset="72%" stopColor="#004f54" stopOpacity={0.08} />
                <Stop offset="100%" stopColor="#001a1c" stopOpacity={0.38} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#panVignette)" />
          </Svg>
        </View>
      </Animated.View>
      {children}
    </>
  );
}

/** Shared parallax translate for map chrome during pan. */
export function mapChromeParallaxStyle(
  parallax: Animated.Value,
  direction: 'up' | 'down' = 'up',
): { transform: { translateY: Animated.AnimatedInterpolation<number> }[] } {
  const sign = direction === 'up' ? -1 : 1;
  return {
    transform: [
      {
        translateY: parallax.interpolate({
          inputRange: [0, 1],
          outputRange: [0, sign * 5],
        }),
      },
    ],
  };
}
