import { EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED } from '@env';
import { parseDemoModeFlag } from '@/config/parseDemoModeFlag';

/** When true, multi-bag group cart and create_group_reservation are enabled. */
export function isGroupReservationsEnabled(): boolean {
  return parseDemoModeFlag(EXPO_PUBLIC_GROUP_RESERVATIONS_ENABLED);
}
