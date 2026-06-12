import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { StitchIcon, StitchText } from '@/ui/stitch';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';

export type RescueCountChipProps = {
  count: number;
  /** Tap → frame every rescue pin (or search this area when the map is empty). */
  onPress: () => void;
};

/**
 * "N rescues here" chip — the map's voice. Tells a first-time user exactly
 * what this surface is for, bounces when the number changes, and doubles as a
 * "show me everything" camera action.
 */
export function RescueCountChip({
  count,
  onPress,
}: RescueCountChipProps): React.ReactElement {
  const { colors } = useStitchTheme();
  const bounce = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current === count) return;
    prevCount.current = count;
    bounce.setValue(0.82);
    Animated.spring(bounce, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [bounce, count]);

  const empty = count === 0;
  const label = empty
    ? 'No rescues in view'
    : count === 1
      ? '1 rescue here'
      : `${count} rescues here`;

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ scale: bounce }] }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          empty ? 'No rescues in view. Search this area' : `${label}. Show all on map`
        }
        testID="discover.map.countChip"
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: `${colors.surface}F2`,
            shadowColor: colors.shadow,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <StitchIcon
          name={empty ? 'search' : 'eco'}
          size={15}
          color={empty ? colors.textMuted : colors.primaryContainer}
        />
        <StitchText variant="label" colorKey={empty ? 'textMuted' : 'text'}>
          {label}
        </StitchText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    ...stitchAmbientShadow,
  },
  pressed: {
    opacity: 0.75,
  },
});
