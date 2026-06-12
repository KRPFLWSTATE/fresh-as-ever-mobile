import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StitchIcon } from '@/ui/stitch';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';

export type MapControlRailProps = {
  showRecenter: boolean;
  followingUser: boolean;
  map3DEnabled: boolean;
  onRecenter: () => void;
  onToggle3D: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

/**
 * Single floating control rail replacing the scattered zoom stack, 2D/3D pill
 * and recenter FAB — one translucent capsule on the map's right edge with the
 * full camera vocabulary: locate, dimension, zoom.
 */
export function MapControlRail({
  showRecenter,
  followingUser,
  map3DEnabled,
  onRecenter,
  onToggle3D,
  onZoomIn,
  onZoomOut,
}: MapControlRailProps): React.ReactElement {
  const { colors } = useStitchTheme();

  const divider = (
    <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
  );

  return (
    <View
      style={[
        styles.rail,
        { backgroundColor: `${colors.surface}F2`, shadowColor: colors.shadow },
      ]}
      pointerEvents="box-none"
    >
      {showRecenter ? (
        <>
          <RailButton
            icon="my_location"
            tint={followingUser ? colors.primaryContainer : colors.textMuted}
            label={followingUser ? 'Following your location' : 'Recenter on me'}
            testID="discover.map.recenter"
            onPress={onRecenter}
          />
          {divider}
        </>
      ) : null}
      <RailButton
        icon="terrain"
        tint={map3DEnabled ? colors.primaryContainer : colors.textMuted}
        label={map3DEnabled ? 'Switch map to 2D view' : 'Switch map to 3D view'}
        testID="discover.map.toggle3D"
        onPress={onToggle3D}
      />
      {divider}
      <RailButton
        icon="add"
        tint={colors.text}
        label="Zoom map in"
        testID="discover.map.zoomIn"
        onPress={onZoomIn}
      />
      <RailButton
        icon="remove"
        tint={colors.text}
        label="Zoom map out"
        testID="discover.map.zoomOut"
        onPress={onZoomOut}
      />
    </View>
  );
}

function RailButton({
  icon,
  tint,
  label,
  testID,
  onPress,
}: {
  icon: React.ComponentProps<typeof StitchIcon>['name'];
  tint: string;
  label: string;
  testID: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}
      hitSlop={4}
    >
      <StitchIcon name={icon} size={20} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 21,
    overflow: 'hidden',
    ...stitchAmbientShadow,
  },
  btn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 9,
  },
});
