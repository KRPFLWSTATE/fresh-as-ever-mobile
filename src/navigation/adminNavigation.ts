import type { NavigationProp } from '@react-navigation/native';
import type { AdminStackParamList, AdminTabParamList } from '@/navigation/types';

/** Navigation that can reach admin tab stacks (tab root or any nested stack screen). */
export type AdminCrossTabNavigation = NavigationProp<AdminTabParamList>;

export function navigateToAdminHome(
  navigation: AdminCrossTabNavigation,
): void {
  navigation.navigate('AdminDashTab', { screen: 'AdminHome' });
}

export function navigateToAdminPlatformOrders(
  navigation: AdminCrossTabNavigation,
  params?: AdminStackParamList['AdminPlatformOrders'],
): void {
  navigation.navigate('AdminOrdersTab', {
    screen: 'AdminPlatformOrders',
    params: { ...params, fromDashboard: true },
  });
}

export function navigateToAdminMerchants(
  navigation: AdminCrossTabNavigation,
  params?: AdminStackParamList['AdminMerchants'],
): void {
  navigation.navigate('AdminMerchantsTab', {
    screen: 'AdminMerchants',
    params,
  });
}

export function navigateToAdminComplaints(
  navigation: AdminCrossTabNavigation,
): void {
  navigation.navigate('AdminDashTab', {
    screen: 'AdminComplaints',
  });
}

export function navigateToAdminPlatformConfig(
  navigation: AdminCrossTabNavigation,
): void {
  navigation.navigate('AdminSettingsTab', {
    screen: 'AdminPlatformConfig',
  });
}
