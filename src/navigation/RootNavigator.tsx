import React, { useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type {
  CustomerTabParamList,
  MerchantTabParamList,
  RootStackParamList,
} from './types';
import { linking } from './linking';
import { navigationRef } from './navigationRef';
import { AuthStackGate } from './authStackGate';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { OrdersScreen } from '@/screens/OrdersScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { BagDetailScreen } from '@/screens/BagDetailScreen';
import { ClearanceShelfScreen } from '@/screens/ClearanceShelfScreen';
import { ShelfReviewScreen } from '@/screens/ShelfReviewScreen';
import { MerchantShelvesListScreen } from '@/screens/MerchantShelvesListScreen';
import { MerchantShelfEditorScreen } from '@/screens/MerchantShelfEditorScreen';
import { MerchantShelfScanItemScreen } from '@/screens/MerchantShelfScanItemScreen';
import { MerchantShelfItemEditorScreen } from '@/screens/MerchantShelfItemEditorScreen';
import { BagAllergensScreen } from '@/screens/BagAllergensScreen';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { OrderDetailScreen } from '@/screens/OrderDetailScreen';
import { OrderReviewScreen } from '@/screens/OrderReviewScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { MerchantDashboardScreen } from '@/screens/MerchantDashboardScreen';
import { MerchantOrdersScreen } from '@/screens/MerchantOrdersScreen';
import { MerchantBagCreateScreen } from '@/screens/MerchantBagCreateScreen';
import { MerchantBagEditScreen } from '@/screens/MerchantBagEditScreen';
import { MerchantBagsListScreen } from '@/screens/MerchantBagsListScreen';
import { MerchantInventoryTabScreen } from '@/screens/MerchantInventoryTabScreen';
import { MerchantBagsTabScreen } from '@/screens/MerchantBagsTabScreen';
import { MerchantShelvesTabScreen } from '@/screens/MerchantShelvesTabScreen';
import { MerchantOrderDetailScreen } from '@/screens/MerchantOrderDetailScreen';
import { MerchantScanHandoverScreen } from '@/screens/MerchantScanHandoverScreen';
import { MerchantOnboardingScreen } from '@/screens/MerchantOnboardingScreen';
import { MerchantFinanceScreen } from '@/screens/MerchantFinanceScreen';
import { MerchantAnalyticsScreen } from '@/screens/MerchantAnalyticsScreen';
import { MerchantPayoutsScreen } from '@/screens/MerchantPayoutsScreen';
import { MerchantPayoutDetailScreen } from '@/screens/MerchantPayoutDetailScreen';
import { MerchantPayoutTransactionsScreen } from '@/screens/MerchantPayoutTransactionsScreen';
import { MerchantProfileScreen } from '@/screens/MerchantProfileScreen';
import { MerchantOutletEditorScreen } from '@/screens/MerchantOutletEditorScreen';
import { OutletDetailScreen } from '@/screens/OutletDetailScreen';
import { SearchResultsScreen } from '@/screens/SearchResultsScreen';
import { MerchantSettingsScreen } from '@/screens/MerchantSettingsScreen';
import { MerchantDisputesScreen } from '@/screens/MerchantDisputesScreen';
import { MerchantComplaintDetailScreen } from '@/screens/MerchantComplaintDetailScreen';
import { MerchantPromotionsScreen } from '@/screens/MerchantPromotionsScreen';
import { MerchantLiveMonitorScreen } from '@/screens/MerchantLiveMonitorScreen';
import { MerchantStaffScreen } from '@/screens/MerchantStaffScreen';
import { FavouritesScreen } from '@/screens/FavouritesScreen';
import { ImpactScreen } from '@/screens/ImpactScreen';
import { ProfileDetailsScreen } from '@/screens/ProfileDetailsScreen';
import { ProfileNotificationsScreen } from '@/screens/ProfileNotificationsScreen';
import { ProfilePaymentsScreen } from '@/screens/ProfilePaymentsScreen';
import { ProfileSupportScreen } from '@/screens/ProfileSupportScreen';
import { ProfileThemeScreen } from '@/screens/ProfileThemeScreen';
import { ConnectionErrorScreen } from '@/screens/ConnectionErrorScreen';
import { WaitlistSuccessScreen } from '@/screens/WaitlistSuccessScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { AdminNavigator } from '@/navigation/AdminNavigator';
import { OrderCelebrationScreen } from '@/screens/OrderCelebrationScreen';
import { SignUpScreen } from '@/screens/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/ForgotPasswordScreen';
import { BrandJourneyScreen } from '@/screens/BrandJourneyScreen';
import { stitchNavigationTheme } from '@/navigation/stitchNavigationTheme';
import { useAuthContext } from '@/context/AuthContext';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { merchantInventoryVisibility } from '@/lib/merchantInventoryVisibility';
import {
  merchantBagsTabMeta,
  merchantInventoryTabMeta,
  merchantShelvesTabMeta,
} from '@/lib/merchantTabInventory';
import { useStitchTheme } from '@/theme/StitchThemeContext';
import { StitchIcon } from '@/ui/stitch';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const CustomerTabs = createBottomTabNavigator<CustomerTabParamList>();
const MerchantTabsNav = createBottomTabNavigator<MerchantTabParamList>();

function TabDiscoverIcon(props: { color: string; size: number }) {
  return <StitchIcon name="explore" size={props.size} color={props.color} />;
}
function TabOrdersIcon(props: { color: string; size: number }) {
  return (
    <StitchIcon name="receipt_long" size={props.size} color={props.color} />
  );
}
function TabFavouritesIcon(props: { color: string; size: number }) {
  return <StitchIcon name="favorite" size={props.size} color={props.color} />;
}
function TabProfileIcon(props: { color: string; size: number }) {
  return <StitchIcon name="person" size={props.size} color={props.color} />;
}
function TabMerchantDashIcon(props: { color: string; size: number }) {
  return <StitchIcon name="home" size={props.size} color={props.color} />;
}
function TabMerchantBagsIcon(props: { color: string; size: number }) {
  return (
    <StitchIcon name="local_mall" size={props.size} color={props.color} />
  );
}
function TabMerchantSettingsIcon(props: { color: string; size: number }) {
  return <StitchIcon name="settings" size={props.size} color={props.color} />;
}

function CustomerTabsScreen() {
  const { colors } = useStitchTheme();
  return (
    <CustomerTabs.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primaryContainer,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        },
      }}
    >
      <CustomerTabs.Screen
        name="DiscoverTab"
        component={DiscoverScreen}
        options={{
          title: 'Fresh As Ever',
          tabBarLabel: 'Discover',
          tabBarIcon: TabDiscoverIcon,
          tabBarButtonTestID: 'tab.discover',
        }}
      />
      <CustomerTabs.Screen
        name="OrdersTab"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: TabOrdersIcon,
          tabBarButtonTestID: 'tab.orders',
        }}
      />
      <CustomerTabs.Screen
        name="FavouritesTab"
        component={FavouritesScreen}
        options={{
          title: 'Favourites',
          tabBarIcon: TabFavouritesIcon,
          tabBarButtonTestID: 'tab.favourites',
        }}
      />
      <CustomerTabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: TabProfileIcon,
          tabBarButtonTestID: 'tab.profile',
        }}
      />
    </CustomerTabs.Navigator>
  );
}

function TabMerchantShelvesIcon(props: { color: string; size: number }) {
  return (
    <StitchIcon name="inventory_2" size={props.size} color={props.color} />
  );
}

function MerchantTabsScreen() {
  const { colors } = useStitchTheme();
  const { env } = useAuthContext();
  const { activeOutlet } = useMerchantContext(env);
  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const { showShelves, showBags, isHybrid } =
    merchantInventoryVisibility(outletCategory);
  const showSingleInventoryTab = (showBags || showShelves) && !isHybrid;
  const singleModeMeta = merchantInventoryTabMeta(outletCategory);
  const bagsMeta = merchantBagsTabMeta(outletCategory);
  const shelvesMeta = merchantShelvesTabMeta();

  const tabsKey = `${String(activeOutlet?.id ?? 'none')}-${outletCategory}`;

  return (
    <MerchantTabsNav.Navigator
      key={tabsKey}
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primaryContainer,
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
        },
      }}
    >
      <MerchantTabsNav.Screen
        name="MerchantDashTab"
        component={MerchantDashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: TabMerchantDashIcon,
        }}
      />
      <MerchantTabsNav.Screen
        name="MerchantOrdersTab"
        component={MerchantOrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: TabOrdersIcon,
        }}
      />
      {showSingleInventoryTab || (isHybrid && showBags) ? (
        <MerchantTabsNav.Screen
          name="MerchantBagsTab"
          component={isHybrid ? MerchantBagsTabScreen : MerchantInventoryTabScreen}
          options={{
            title: isHybrid ? bagsMeta.headerTitle : singleModeMeta.headerTitle,
            tabBarLabel: isHybrid ? bagsMeta.tabBarLabel : singleModeMeta.tabBarLabel,
            tabBarIcon: isHybrid
              ? TabMerchantBagsIcon
              : singleModeMeta.iconName === 'inventory_2'
                ? TabMerchantShelvesIcon
                : TabMerchantBagsIcon,
          }}
        />
      ) : null}
      {isHybrid && showShelves ? (
        <MerchantTabsNav.Screen
          name="MerchantShelvesTab"
          component={MerchantShelvesTabScreen}
          options={{
            title: shelvesMeta.headerTitle,
            tabBarLabel: shelvesMeta.tabBarLabel,
            tabBarIcon: TabMerchantShelvesIcon,
          }}
        />
      ) : null}
      <MerchantTabsNav.Screen
        name="MerchantSettingsTab"
        component={MerchantSettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: TabMerchantSettingsIcon,
        }}
      />
    </MerchantTabsNav.Navigator>
  );
}

export function RootNavigator() {
  const { colors, colorScheme } = useStitchTheme();
  const [navigationReady, setNavigationReady] = useState(false);
  const navTheme = useMemo(
    () => stitchNavigationTheme(colorScheme === 'dark'),
    [colorScheme],
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={navTheme}
      onReady={() => setNavigationReady(true)}
    >
      <AuthStackGate navigationReady={navigationReady} />
      <RootStack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primaryContainer,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <RootStack.Screen
          name="MainTabs"
          component={CustomerTabsScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="MerchantTabs"
          component={MerchantTabsScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen name="BagDetail" component={BagDetailScreen} />
        <RootStack.Screen
          name="ClearanceShelf"
          component={ClearanceShelfScreen}
          options={{ title: 'Clearance shelf' }}
        />
        <RootStack.Screen
          name="ShelfReview"
          component={ShelfReviewScreen}
          options={{ title: 'Review shelf', headerShown: false }}
        />
        <RootStack.Screen
          name="BagAllergens"
          component={BagAllergensScreen}
          options={{ title: 'Allergens' }}
        />
        <RootStack.Screen name="Checkout" component={CheckoutScreen} />
        <RootStack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <RootStack.Screen
          name="OrderReview"
          component={OrderReviewScreen}
          options={{ title: 'Review' }}
        />
        <RootStack.Screen
          name="Favourites"
          component={FavouritesScreen}
          options={{ title: 'Favourites' }}
        />
        <RootStack.Screen
          name="OutletDetail"
          component={OutletDetailScreen}
          options={{ title: 'Outlet' }}
        />
        <RootStack.Screen
          name="SearchResults"
          component={SearchResultsScreen}
          options={{ title: 'Search' }}
        />
        <RootStack.Screen
          name="Impact"
          component={ImpactScreen}
          options={{ title: 'Impact' }}
        />
        <RootStack.Screen
          name="ProfileDetails"
          component={ProfileDetailsScreen}
          options={{ title: 'Edit Profile' }}
        />
        <RootStack.Screen
          name="ProfileNotifications"
          component={ProfileNotificationsScreen}
          options={{ title: 'Notifications' }}
        />
        <RootStack.Screen
          name="ProfilePayments"
          component={ProfilePaymentsScreen}
          options={{ title: 'Payments' }}
        />
        <RootStack.Screen
          name="ProfileSupport"
          component={ProfileSupportScreen}
          options={{ title: 'Support' }}
        />
        <RootStack.Screen
          name="ProfileTheme"
          component={ProfileThemeScreen}
          options={{ title: 'Appearance' }}
        />
        <RootStack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Sign in' }}
        />
        <RootStack.Screen
          name="MerchantBagCreate"
          component={MerchantBagCreateScreen}
          options={{ title: 'List Rescue Bag' }}
        />
        <RootStack.Screen
          name="MerchantBagEdit"
          component={MerchantBagEditScreen}
          options={{ title: 'Edit Rescue Bag' }}
        />
        <RootStack.Screen
          name="MerchantBagsList"
          component={MerchantBagsListScreen}
          options={{ title: 'Rescue Bags' }}
        />
        <RootStack.Screen
          name="MerchantShelvesList"
          component={MerchantShelvesListScreen}
          options={{ title: 'Clearance shelves' }}
        />
        <RootStack.Screen
          name="MerchantShelfEditor"
          component={MerchantShelfEditorScreen}
          options={{ title: "Today's shelf", headerBackTitle: 'Shelves' }}
        />
        <RootStack.Screen
          name="MerchantShelfScanItem"
          component={MerchantShelfScanItemScreen}
          options={{ title: 'Scan barcode', headerBackTitle: 'Shelf' }}
        />
        <RootStack.Screen
          name="MerchantShelfItemEditor"
          component={MerchantShelfItemEditorScreen}
          options={{ title: 'Shelf item', headerBackTitle: 'Shelf' }}
        />
        <RootStack.Screen
          name="MerchantOrderDetail"
          component={MerchantOrderDetailScreen}
          options={{ title: 'Order', headerBackTitle: 'Orders' }}
        />
        <RootStack.Screen
          name="MerchantScanHandover"
          component={MerchantScanHandoverScreen}
          options={{ title: 'Scan QR', headerBackTitle: 'Orders' }}
        />
        <RootStack.Screen
          name="MerchantOnboarding"
          component={MerchantOnboardingScreen}
          options={{ title: 'Onboarding' }}
        />
        <RootStack.Screen
          name="MerchantAnalytics"
          component={MerchantAnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <RootStack.Screen
          name="MerchantFinance"
          component={MerchantFinanceScreen}
          options={{ title: 'Finance' }}
        />
        <RootStack.Screen
          name="MerchantPayouts"
          component={MerchantPayoutsScreen}
          options={{ title: 'Payouts' }}
        />
        <RootStack.Screen
          name="MerchantPayoutDetail"
          component={MerchantPayoutDetailScreen}
          options={{ title: 'Payout Detail' }}
        />
        <RootStack.Screen
          name="MerchantPayoutTransactions"
          component={MerchantPayoutTransactionsScreen}
          options={{ title: 'Transactions' }}
        />
        <RootStack.Screen
          name="MerchantProfile"
          component={MerchantProfileScreen}
          options={{ title: 'Profile' }}
        />
        <RootStack.Screen
          name="MerchantOutletEditor"
          component={MerchantOutletEditorScreen}
          options={{ title: 'Edit outlet' }}
        />
        <RootStack.Screen
          name="MerchantSettings"
          component={MerchantSettingsScreen}
          options={{ title: 'Settings' }}
        />
        <RootStack.Screen
          name="MerchantDisputes"
          component={MerchantDisputesScreen}
          options={{ title: 'Disputes' }}
        />
        <RootStack.Screen
          name="MerchantComplaintDetail"
          component={MerchantComplaintDetailScreen}
          options={{ title: 'Dispute' }}
        />
        <RootStack.Screen
          name="MerchantPromotions"
          component={MerchantPromotionsScreen}
          options={{ title: 'Promotions' }}
        />
        <RootStack.Screen
          name="MerchantLiveMonitor"
          component={MerchantLiveMonitorScreen}
          options={{ title: 'Live monitor' }}
        />
        <RootStack.Screen
          name="MerchantStaff"
          component={MerchantStaffScreen}
          options={{ title: 'Staff accounts' }}
        />
        <RootStack.Screen
          name="WaitlistSuccess"
          component={WaitlistSuccessScreen}
          options={{ title: 'Waitlist' }}
        />
        <RootStack.Screen
          name="ConnectionError"
          component={ConnectionErrorScreen}
          options={{ title: 'Connection error' }}
        />
        <RootStack.Screen
          name="AdminShell"
          component={AdminNavigator}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="OrderCelebration"
          component={OrderCelebrationScreen}
          options={{ title: 'Success', headerShown: false }}
        />
        <RootStack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ title: 'Sign up' }}
        />
        <RootStack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ title: 'Forgot password' }}
        />
        <RootStack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="BrandJourney"
          component={BrandJourneyScreen}
          options={{ title: 'Journey' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
