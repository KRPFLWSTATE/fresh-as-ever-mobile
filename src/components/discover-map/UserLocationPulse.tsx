import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

export type UserLocationPulseProps = {
  coordinate: { latitude: number; longitude: number };
  /** Brand color for the core dot + rings. */
  color: string;
  /**
   * When false the radar loop pauses and rasterisation stops — use while the
   * feed scrolls or the map block is off-screen to avoid nested-map jank.
   */
  active?: boolean;
};

const CANVAS = 72;

/**
 * "You are here" as a quiet radar: a solid brand dot with two soft rings that
 * breathe outward on a loop — the map is scanning for rescues around you.
 * Replaces both the native blue dot (laggy in nested maps / simulators) and
 * the old static fallback ring.
 */
export function UserLocationPulse({
  coordinate,
  color,
  active = true,
}: UserLocationPulseProps): React.ReactElement {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    loopsRef.current.forEach((l) => l.stop());
    loopsRef.current = [];

    if (!active) {
      pulseA.setValue(0);
      pulseB.setValue(0);
      setTracksViewChanges(false);
      return;
    }

    setTracksViewChanges(true);
    const makeLoop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 2_400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a = makeLoop(pulseA, 0);
    const b = makeLoop(pulseB, 1_200);
    loopsRef.current = [a, b];
    a.start();
    b.start();
    const settle = setTimeout(() => setTracksViewChanges(false), 900);
    return () => {
      clearTimeout(settle);
      loopsRef.current.forEach((l) => l.stop());
      loopsRef.current = [];
    };
  }, [active, pulseA, pulseB]);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 0.4, 0],
    }),
    transform: [
      {
        scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
      },
    ],
  });

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={2000}
      tracksViewChanges={tracksViewChanges}
      pointerEvents="none"
      accessibilityLabel="Your location"
    >
      <View style={styles.canvas} collapsable={false} pointerEvents="none">
        <Animated.View
          style={[styles.ring, { borderColor: color, backgroundColor: `${color}22` }, ringStyle(pulseA)]}
        />
        <Animated.View
          style={[styles.ring, { borderColor: color, backgroundColor: `${color}22` }, ringStyle(pulseB)]}
        />
        <View style={[styles.core, { backgroundColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS,
    height: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: CANVAS,
    height: CANVAS,
    borderRadius: CANVAS / 2,
    borderWidth: 1.5,
  },
  core: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
