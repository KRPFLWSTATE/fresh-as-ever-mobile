import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import type { StitchResolvedPalette } from '@/theme/StitchThemeContext';
import { stitchIconMap, type StitchIconName } from '@/ui/stitch/iconMap';

export type StitchIconColorKey = keyof StitchResolvedPalette;

type Props = {
  name: StitchIconName;
  size?: number;
  colorKey?: StitchIconColorKey;
  color?: string;
  style?: React.ComponentProps<typeof MaterialIcons>['style'];
};

export function StitchIcon({
  name,
  size = 24,
  colorKey,
  color,
  style,
}: Props): React.ReactElement {
  const { colors } = useStitchTheme();
  const resolved =
    color ??
    (colorKey ? colors[colorKey] : colors.onSurfaceVariant);
  const glyph = stitchIconMap[name];
  return (
    <MaterialIcons
      name={glyph}
      size={size}
      color={resolved}
      style={style}
    />
  );
}
