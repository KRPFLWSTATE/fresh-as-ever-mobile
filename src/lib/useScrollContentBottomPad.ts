import * as React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStitchTheme } from '@/theme/StitchThemeContext';

type SpacingKey = 'xxl' | 'xl' | 'lg';

/**
 * Bottom padding for scrollable / list content so the last row clears the bottom tab bar
 * when rendered inside a bottom tab navigator, or the home indicator when shown as a
 * full-screen stack modal (no tab bar context).
 */
export function useScrollContentBottomPad(base: SpacingKey = 'xxl'): number {
  const { spacing } = useStitchTheme();
  const insets = useSafeAreaInsets();
  const tab = React.useContext(BottomTabBarHeightContext);
  const tabH = typeof tab === 'number' ? tab : 0;
  const bottomChrome = tabH > 0 ? tabH : insets.bottom;
  return spacing[base] + bottomChrome;
}
