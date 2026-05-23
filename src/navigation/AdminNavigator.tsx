import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type {
  AdminStackParamList,
  AdminTabParamList,
} from '@/navigation/types';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon } from '@/ui/stitch';
import {
  AdminApplicationReviewScreen,
  AdminAuditLogsScreen,
  AdminComplaintDetailScreen,
  AdminComplaintsScreen,
  AdminHomeScreen,
  AdminMerchantDetailScreen,
  AdminMerchantsScreen,
  AdminPlatformConfigScreen,
  AdminPlatformOrderDetailScreen,
  AdminPlatformOrdersScreen,
  AdminPromosAdminScreen,
  AdminSettlementDetailScreen,
  AdminSettlementsScreen,
  AdminSystemSettingsScreen,
} from '@/screens/admin/AdminStackScreens';

const Tabs = createBottomTabNavigator<AdminTabParamList>();
const DashStack = createNativeStackNavigator<AdminStackParamList>();
const OrdersStack = createNativeStackNavigator<AdminStackParamList>();
const MerchantsStack = createNativeStackNavigator<AdminStackParamList>();
const SettingsStack = createNativeStackNavigator<AdminStackParamList>();

function useAdminScreenOptions() {
  const { colors } = useStitchTheme();
  return {
    headerTitleAlign: 'center' as const,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primaryContainer,
    headerTitleStyle: { fontWeight: '600' as const },
  };
}

function AdminDashStackScreen() {
  const screenOptions = useAdminScreenOptions();
  return (
    <DashStack.Navigator initialRouteName="AdminHome" screenOptions={screenOptions}>
      <DashStack.Screen
        name="AdminHome"
        component={AdminHomeScreen}
        options={({ route }) => ({
          title: route.params?.colombo ? 'Admin · Colombo' : 'Admin dashboard',
        })}
      />
      <DashStack.Screen
        name="AdminSettlements"
        component={AdminSettlementsScreen}
        options={{ title: 'Settlements' }}
      />
      <DashStack.Screen
        name="AdminSettlementDetail"
        component={AdminSettlementDetailScreen}
        options={{ title: 'Settlement detail' }}
      />
      <DashStack.Screen
        name="AdminComplaints"
        component={AdminComplaintsScreen}
        options={{ title: 'Complaints' }}
      />
      <DashStack.Screen
        name="AdminComplaintDetail"
        component={AdminComplaintDetailScreen}
        options={{ title: 'Complaint detail' }}
      />
      <DashStack.Screen
        name="AdminAuditLogs"
        component={AdminAuditLogsScreen}
        options={{ title: 'Audit logs' }}
      />
      <DashStack.Screen
        name="AdminSystemSettings"
        component={AdminSystemSettingsScreen}
        options={{ title: 'Platform settings' }}
      />
      <DashStack.Screen
        name="AdminApplicationReview"
        component={AdminApplicationReviewScreen}
        options={{ title: 'Application review' }}
      />
      <DashStack.Screen
        name="AdminPromosAdmin"
        component={AdminPromosAdminScreen}
        options={{ title: 'Promo management' }}
      />
    </DashStack.Navigator>
  );
}

function AdminOrdersStackScreen() {
  const screenOptions = useAdminScreenOptions();
  return (
    <OrdersStack.Navigator
      initialRouteName="AdminPlatformOrders"
      screenOptions={screenOptions}
    >
      <OrdersStack.Screen
        name="AdminPlatformOrders"
        component={AdminPlatformOrdersScreen}
        options={{ title: 'Platform orders' }}
      />
      <OrdersStack.Screen
        name="AdminPlatformOrderDetail"
        component={AdminPlatformOrderDetailScreen}
        options={{ title: 'Order detail' }}
      />
    </OrdersStack.Navigator>
  );
}

function AdminMerchantsStackScreen() {
  const screenOptions = useAdminScreenOptions();
  return (
    <MerchantsStack.Navigator
      initialRouteName="AdminMerchants"
      screenOptions={screenOptions}
    >
      <MerchantsStack.Screen
        name="AdminMerchants"
        component={AdminMerchantsScreen}
        options={{ title: 'Merchants' }}
      />
      <MerchantsStack.Screen
        name="AdminMerchantDetail"
        component={AdminMerchantDetailScreen}
        options={{ title: 'Merchant detail' }}
      />
    </MerchantsStack.Navigator>
  );
}

function AdminSettingsStackScreen() {
  const screenOptions = useAdminScreenOptions();
  return (
    <SettingsStack.Navigator
      initialRouteName="AdminPlatformConfig"
      screenOptions={screenOptions}
    >
      <SettingsStack.Screen
        name="AdminPlatformConfig"
        component={AdminPlatformConfigScreen}
        options={{ title: 'Configuration' }}
      />
    </SettingsStack.Navigator>
  );
}

function AdminDashIcon(props: { color: string; size: number }) {
  return <StitchIcon name="dashboard" size={props.size} color={props.color} />;
}
function AdminOrdersIcon(props: { color: string; size: number }) {
  return (
    <StitchIcon name="receipt_long" size={props.size} color={props.color} />
  );
}
function AdminMerchantsIcon(props: { color: string; size: number }) {
  return (
    <StitchIcon name="storefront" size={props.size} color={props.color} />
  );
}
function AdminSettingsIcon(props: { color: string; size: number }) {
  return <StitchIcon name="settings" size={props.size} color={props.color} />;
}

export function AdminNavigator() {
  const { colors } = useStitchTheme();
  return (
    <Tabs.Navigator
      initialRouteName="AdminDashTab"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        },
      }}
    >
      <Tabs.Screen
        name="AdminDashTab"
        component={AdminDashStackScreen}
        options={{ title: 'Dashboard', tabBarIcon: AdminDashIcon }}
      />
      <Tabs.Screen
        name="AdminOrdersTab"
        component={AdminOrdersStackScreen}
        options={{ title: 'Orders', tabBarIcon: AdminOrdersIcon }}
      />
      <Tabs.Screen
        name="AdminMerchantsTab"
        component={AdminMerchantsStackScreen}
        options={{ title: 'Merchants', tabBarIcon: AdminMerchantsIcon }}
      />
      <Tabs.Screen
        name="AdminSettingsTab"
        component={AdminSettingsStackScreen}
        options={{ title: 'Settings', tabBarIcon: AdminSettingsIcon }}
      />
    </Tabs.Navigator>
  );
}
