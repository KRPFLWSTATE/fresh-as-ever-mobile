import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { merchantInventoryVisibility } from '@/lib/merchantInventoryVisibility';
import type { RootStackParamList } from '@/navigation/types';

/** Whether the active outlet may list or manage clearance shelves. */
export function useMerchantClearanceShelfGuard() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { env } = useAuthContext();
  const { activeOutlet } = useMerchantContext(env);
  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const { showShelves: allowed, isHybrid } =
    merchantInventoryVisibility(outletCategory);

  const goToBags = useCallback(() => {
    const parent = navigation.getParent();
    if (parent?.navigate) {
      parent.navigate('MerchantBagsTab' as never);
      return;
    }
    navigation.navigate('MerchantBagsList');
  }, [navigation]);

  const goToShelvesTab = useCallback(() => {
    const parent = navigation.getParent();
    if (parent?.navigate) {
      if (isHybrid) {
        parent.navigate('MerchantShelvesTab' as never);
      } else {
        parent.navigate('MerchantBagsTab' as never);
      }
      return;
    }
    navigation.navigate('MerchantShelvesList');
  }, [isHybrid, navigation]);

  return { allowed, outletCategory, goToBags, goToShelvesTab };
}
