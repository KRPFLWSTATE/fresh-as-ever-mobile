import React, { useLayoutEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import {
  merchantInventoryVisibility,
  pickMerchantInventoryListKind,
} from '@/lib/merchantInventoryVisibility';
import { merchantInventoryTabMeta } from '@/lib/merchantTabInventory';
import type { MerchantTabParamList } from '@/navigation/types';
import { MerchantBagsListScreen } from '@/screens/MerchantBagsListScreen';
import { MerchantShelvesListScreen } from '@/screens/MerchantShelvesListScreen';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon, StitchScreen, StitchText } from '@/ui/stitch';

/**
 * Bottom-tab inventory for single-mode outlets (supermarket shelves-only or café bags-only).
 * Hybrid merchants use separate `MerchantBagsTab` + `MerchantShelvesTab` screens instead.
 */
export function MerchantInventoryTabScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<MerchantTabParamList, 'MerchantBagsTab'>>();
  const { env } = useAuthContext();
  const { activeOutlet, loading: contextLoading } = useMerchantContext(env);
  const { colors, spacing } = useStitchTheme();

  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const { mode } = merchantInventoryVisibility(outletCategory);
  const listKind = pickMerchantInventoryListKind(outletCategory);

  const tabMeta = useMemo(
    () => merchantInventoryTabMeta(outletCategory),
    [outletCategory],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tabMeta.headerTitle,
      tabBarLabel: tabMeta.tabBarLabel,
      tabBarIcon: ({ color, size }: { color: string; size: number }) => (
        <StitchIcon name={tabMeta.iconName} size={size} color={color} />
      ),
    });
  }, [navigation, tabMeta]);

  if (contextLoading && !outletCategory) {
    return (
      <StitchScreen edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primaryContainer} />
        </View>
      </StitchScreen>
    );
  }

  if (listKind === 'shelves') {
    return <MerchantShelvesListScreen embeddedInTab />;
  }

  if (listKind === 'bags') {
    return <MerchantBagsListScreen embeddedInTab />;
  }

  return (
    <StitchScreen scroll>
      <StitchText variant="body-md" colorKey="textMuted" style={{ padding: spacing.md }}>
        No inventory mode is available for this outlet category ({mode}).
      </StitchText>
    </StitchScreen>
  );
}
