import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { stitchAmbientShadow } from '@/theme/stitchTokens';

type Props = ViewProps & {
  /** Card-style elevation (Stitch `ambient-shadow`). */
  elevated?: boolean;
  padding?: 'none' | 'md' | 'lg' | 'xl';
};

const padMap = { none: 0, md: 16, lg: 24, xl: 32 } as const;

export function StitchSurface({
  elevated,
  padding = 'md',
  style,
  children,
  ...rest
}: Props): React.ReactElement {
  const { colors, radii, spacing } = useStitchTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          padding: padMap[padding] ?? spacing.md,
        },
        elevated ? stitchAmbientShadow : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
