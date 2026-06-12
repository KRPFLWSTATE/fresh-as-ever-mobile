import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { DiscoverMapOutletMarker } from '@/lib/discoverMapMarkers';
import { StitchIcon, StitchText } from '@/ui/stitch';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';
import {
  DISCOVER_LOW_STOCK_THRESHOLD,
  DISCOVER_MARKER_VISUALS,
} from '@/components/discover-map/discoverMapPalette';

export type SelectedRescuePreviewProps = {
  marker: DiscoverMapOutletMarker | null;
  onOpen: (marker: DiscoverMapOutletMarker) => void;
  onDismiss: () => void;
};

function previewSubtitle(marker: DiscoverMapOutletMarker): string {
  const { bagsLeft, hasShelf } = marker;
  if (bagsLeft != null && bagsLeft > 0) {
    const bags = bagsLeft === 1 ? '1 bag left' : `${bagsLeft} bags left`;
    return hasShelf ? `${bags} · clearance shelf live` : bags;
  }
  if (hasShelf || marker.feedKind === 'shelf') return 'Clearance shelf live now';
  if (bagsLeft === 0) return 'Sold out for today';
  return marker.title;
}

/**
 * Slide-up rescue card pinned to the map's lower edge. Selecting a pin shows
 * who the outlet is and what's left before committing to a detail screen —
 * tap the card to open the outlet, tap the map to dismiss.
 */
export function SelectedRescuePreview({
  marker,
  onOpen,
  onDismiss,
}: SelectedRescuePreviewProps): React.ReactElement | null {
  const { colors } = useStitchTheme();
  const slide = useRef(new Animated.Value(0)).current;
  // Keep the last marker while sliding out so the card doesn't blank mid-exit.
  const [shown, setShown] = useState<DiscoverMapOutletMarker | null>(marker);

  useEffect(() => {
    if (marker) {
      setShown(marker);
      Animated.spring(slide, {
        toValue: 1,
        friction: 7.5,
        tension: 90,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(slide, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [marker, slide]);

  if (!shown) return null;

  const visual = DISCOVER_MARKER_VISUALS[shown.markerKind];
  const urgent =
    shown.bagsLeft != null &&
    shown.bagsLeft > 0 &&
    shown.bagsLeft <= DISCOVER_LOW_STOCK_THRESHOLD;

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
                outputRange: [64, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents={marker ? 'box-none' : 'none'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shown.outletName}`}
        testID="discover.map.preview"
        onPress={() => onOpen(shown)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: `${colors.surface}FA`,
            shadowColor: colors.shadow,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: visual.fill }]}>
          <StitchIcon name={visual.icon} size={18} color="#FFF8EE" />
        </View>
        <View style={styles.copy}>
          <StitchText variant="label" colorKey="text" numberOfLines={1}>
            {shown.outletName}
          </StitchText>
          <StitchText
            variant="body-sm"
            colorKey={urgent ? 'accent' : 'textMuted'}
            numberOfLines={1}
          >
            {previewSubtitle(shown)}
          </StitchText>
        </View>
        <StitchIcon name="chevron_right" size={22} colorKey="primaryContainer" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss rescue preview"
        testID="discover.map.previewDismiss"
        onPress={onDismiss}
        hitSlop={6}
        style={[styles.dismiss, { backgroundColor: `${colors.surface}FA` }]}
      >
        <StitchIcon name="close" size={14} colorKey="textMuted" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 64,
    bottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 18,
    ...stitchAmbientShadow,
  },
  pressed: {
    opacity: 0.85,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  dismiss: {
    position: 'absolute',
    top: -8,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
