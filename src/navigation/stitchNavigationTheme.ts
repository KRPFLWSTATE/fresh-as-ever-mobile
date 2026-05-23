import type { Theme } from '@react-navigation/native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { stitchColorsDark, stitchColorsLight } from '@/theme/stitchTokens';

export function stitchNavigationTheme(dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  const c = dark ? stitchColorsDark : stitchColorsLight;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primaryContainer,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.divider,
      notification: c.error,
    },
  };
}
