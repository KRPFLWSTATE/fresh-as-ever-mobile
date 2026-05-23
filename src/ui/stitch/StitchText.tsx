import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import type { StitchResolvedPalette } from '@/theme/StitchThemeContext';
import type { StitchTextRole } from '@/theme/stitchTokens';

export type StitchTextColorKey = keyof StitchResolvedPalette;

type Props = TextProps & {
  variant: StitchTextRole;
  colorKey?: StitchTextColorKey;
};

export function StitchText({
  variant,
  colorKey = 'text',
  style,
  children,
  ...rest
}: Props): React.ReactElement {
  const { textRole, colors } = useStitchTheme();
  const base = textRole(variant);
  const color = colors[colorKey] ?? colors.text;
  return (
    <Text style={[base, { color }, style]} {...rest}>
      {children}
    </Text>
  );
}
