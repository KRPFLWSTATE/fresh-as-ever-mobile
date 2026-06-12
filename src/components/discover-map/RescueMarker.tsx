import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { DiscoverMapOutletMarker } from '@/lib/discoverMapMarkers';
import { StitchIcon } from '@/ui/stitch';
import {
  DISCOVER_LOW_STOCK_THRESHOLD,
  DISCOVER_MAP_ACCENT,
  DISCOVER_MARKER_VISUALS,
} from '@/components/discover-map/discoverMapPalette';
import { stitchFonts } from '@/theme/stitchTokens';

export type RescueMarkerProps = {
  marker: DiscoverMapOutletMarker;
  /** Mount order — staggers the drop-in so pins land like a scattered handful. */
  index: number;
  selected: boolean;
  onPress: () => void;
};

const HEAD_SIZE = 38;
const TAIL_HEIGHT = 9;
/** Fixed canvas so MapKit never rasterises the annotation view at 0×0. */
const CANVAS_W = 56;
const CANVAS_H = HEAD_SIZE + TAIL_HEIGHT + 14;

/**
 * Fresh As Ever "rescue drop" pin — a saturated category badge on a cream
 * ring with a short tail. Drops in with a staggered spring when it first
 * appears, swells when selected, and carries an amber count badge when the
 * outlet is down to its last few bags.
 *
 * Rasterisation: `tracksViewChanges` stays on while the pin animates
 * (drop-in, selection change) and is released afterwards so idle pins cost
 * nothing during pan/zoom.
 */
export function RescueMarker({
  marker,
  index,
  selected,
  onPress,
}: RescueMarkerProps): React.ReactElement {
  const visual = DISCOVER_MARKER_VISUALS[marker.markerKind];
  const soldOut = marker.bagsLeft === 0 && !marker.hasShelf;
  const lowStock =
    !soldOut &&
    marker.bagsLeft != null &&
    marker.bagsLeft > 0 &&
    marker.bagsLeft <= DISCOVER_LOW_STOCK_THRESHOLD;

  const drop = useRef(new Animated.Value(0)).current;
  const selectScale = useRef(new Animated.Value(1)).current;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    const delay = Math.min(index, 10) * 70;
    const anim = Animated.spring(drop, {
      toValue: 1,
      delay,
      friction: 5.5,
      tension: 70,
      useNativeDriver: true,
    });
    anim.start();
    // Release rasterisation once the spring has visibly settled.
    const settle = setTimeout(() => setTracksViewChanges(false), delay + 750);
    return () => {
      anim.stop();
      clearTimeout(settle);
    };
  }, [drop, index]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setTracksViewChanges(true);
    Animated.spring(selectScale, {
      toValue: selected ? 1.22 : 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    const settle = setTimeout(() => setTracksViewChanges(false), 600);
    return () => clearTimeout(settle);
  }, [selected, selectScale]);

  const dropStyle = useMemo(
    () => ({
      opacity: drop,
      transform: [
        {
          translateY: drop.interpolate({
            inputRange: [0, 1],
            outputRange: [-14, 0],
          }),
        },
        { scale: Animated.multiply(drop, selectScale) },
      ],
    }),
    [drop, selectScale],
  );

  return (
    <Marker
      coordinate={marker.coordinate}
      anchor={{ x: 0.5, y: 1 }}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      tracksViewChanges={tracksViewChanges}
      zIndex={selected ? 900 : marker.markerKind === 'hybrid' ? 40 : 24}
      testID={`discover.mapMarker.${marker.markerKey}`}
      accessibilityLabel={`${marker.outletName}, ${visual.label}`}
    >
      <Animated.View style={[styles.canvas, dropStyle]} collapsable={false}>
        <View
          style={[
            styles.head,
            {
              backgroundColor: visual.fill,
              borderColor: selected ? DISCOVER_MAP_ACCENT : '#FFF8EE',
            },
            soldOut ? styles.soldOut : null,
          ]}
        >
          <StitchIcon name={visual.icon} size={19} color="#FFF8EE" />
        </View>
        <View
          style={[
            styles.tail,
            { borderTopColor: selected ? DISCOVER_MAP_ACCENT : visual.deep },
            soldOut ? styles.soldOut : null,
          ]}
        />
        {lowStock ? (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>{marker.bagsLeft}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  head: {
    width: HEAD_SIZE,
    height: HEAD_SIZE,
    borderRadius: HEAD_SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e1b14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  soldOut: {
    opacity: 0.45,
  },
  stockBadge: {
    position: 'absolute',
    top: 0,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: DISCOVER_MAP_ACCENT,
    borderWidth: 1.5,
    borderColor: '#FFF8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadgeText: {
    color: '#FFF8EE',
    fontSize: 11,
    lineHeight: 13,
    fontFamily: stitchFonts.bold,
  },
});
