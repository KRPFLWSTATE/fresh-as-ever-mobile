import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { merchantBagsTabMeta } from '@/lib/merchantTabInventory';
import type { MerchantTabParamList } from '@/navigation/types';
import { MerchantBagsListScreen } from '@/screens/MerchantBagsListScreen';
import { StitchIcon } from '@/ui/stitch';

/** Hybrid bottom tab — rescue bags only (shelves live on `MerchantShelvesTab`). */
export function MerchantBagsTabScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<MerchantTabParamList, 'MerchantBagsTab'>>();
  const { env } = useAuthContext();
  const { activeOutlet } = useMerchantContext(env);
  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const tabMeta = merchantBagsTabMeta(outletCategory);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tabMeta.headerTitle,
      tabBarLabel: tabMeta.tabBarLabel,
      tabBarIcon: ({ color, size }: { color: string; size: number }) => (
        <StitchIcon name={tabMeta.iconName} size={size} color={color} />
      ),
    });
  }, [navigation, tabMeta]);

  return <MerchantBagsListScreen embeddedInTab />;
}
