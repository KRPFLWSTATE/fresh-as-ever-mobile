import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { merchantShelvesTabMeta } from '@/lib/merchantTabInventory';
import type { MerchantTabParamList } from '@/navigation/types';
import { MerchantShelvesListScreen } from '@/screens/MerchantShelvesListScreen';
import { StitchIcon } from '@/ui/stitch';

/** Hybrid bottom tab — clearance shelves only (bags live on `MerchantBagsTab`). */
export function MerchantShelvesTabScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<MerchantTabParamList, 'MerchantShelvesTab'>>();
  const tabMeta = merchantShelvesTabMeta();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tabMeta.headerTitle,
      tabBarLabel: tabMeta.tabBarLabel,
      tabBarIcon: ({ color, size }: { color: string; size: number }) => (
        <StitchIcon name={tabMeta.iconName} size={size} color={color} />
      ),
    });
  }, [navigation, tabMeta]);

  return <MerchantShelvesListScreen embeddedInTab />;
}
