import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MerchantOrdersView } from '@/domain/merchantOrdersView';

/** Nested stack under `AdminShell` (Stitch admin surface). */
export type AdminStackParamList = {
  AdminHome: { colombo?: boolean } | undefined;
  AdminSettlements: { segmentIndex?: number } | undefined;
  /**
   * `day` is a YYYY-MM-DD local-date string. When present, the screen restricts the
   * orders query to that calendar day (`created_at >= day AND created_at < day+1`) and
   * surfaces a removable chip ("Showing orders for May 8"). Deep link:
   * `freshasever://admin/orders/day/2026-05-08`.
   */
  AdminPlatformOrders: { day?: string; fromDashboard?: boolean } | undefined;
  AdminPlatformOrderDetail: { orderId: string };
  AdminPlatformConfig: undefined;
  AdminComplaints: undefined;
  AdminComplaintDetail: { complaintId: string };
  AdminSettlementDetail: { settlementId: string };
  AdminAuditLogs: undefined;
  AdminSystemSettings: undefined;
  AdminMerchants: { applicationReview?: boolean } | undefined;
  AdminMerchantDetail: { merchantId: string };
  AdminApplicationReview: undefined;
  AdminPromosAdmin: undefined;
};

export type CustomerTabParamList = {
  DiscoverTab: { state?: string } | undefined;
  OrdersTab: undefined;
  /**
   * Mirrors Stitch `discover_light_mode` BottomNavBar which lists Favourites as a
   * top-level tab alongside Discover / Orders / Profile. The stack route
   * `Favourites` is also retained for legacy programmatic navigation; both mount
   * `FavouritesScreen`.
   */
  FavouritesTab: undefined;
  /**
   * Stitch `profile_light_mode_2` renders a centered-logo header rather than the
   * default tab title chrome. Pass `headerVariant: 'logo'` (deep link
   * `freshasever://profile?headerVariant=logo`) to switch.
   */
  ProfileTab: { suspended?: string; headerVariant?: 'title' | 'logo' } | undefined;
};

export type MerchantTabParamList = {
  MerchantDashTab: undefined;
  MerchantOrdersTab: { view?: MerchantOrdersView } | undefined;
  /**
   * Stitch `merchant_dashboard` BottomNavBar surfaces a top-level "Bags" tab that
   * mirrors `MerchantBagsListScreen`. The stack route `MerchantBagsList` remains
   * registered for direct pushes; both mount the same component.
   */
  MerchantBagsTab: undefined;
  /**
   * Stitch `merchant_dashboard` BottomNavBar surfaces a top-level "Settings" tab
   * that mirrors `MerchantSettingsScreen`. The stack route `MerchantSettings`
   * remains registered for direct pushes; both mount the same component.
   */
  MerchantSettingsTab: undefined;
};

/**
 * Top-level admin bottom-tab bar (mirrors Stitch `admin_dashboard_1` mobile
 * BottomNavBar: Dashboard · Orders · Merchants · Settings). Each tab is itself a
 * native stack so admin detail screens (`AdminMerchantDetail`,
 * `AdminPlatformOrderDetail`, etc.) can push without losing the tab bar.
 *
 * Param shape: every tab key forwards a `NavigatorScreenParams<AdminStackParamList>`
 * so cross-tab deep links and programmatic `navigation.navigate('AdminHome', ...)`
 * calls (with React Navigation's parent-resolution) continue to resolve.
 */
export type AdminTabParamList = {
  AdminDashTab: NavigatorScreenParams<AdminStackParamList> | undefined;
  AdminOrdersTab: NavigatorScreenParams<AdminStackParamList> | undefined;
  AdminMerchantsTab: NavigatorScreenParams<AdminStackParamList> | undefined;
  AdminSettingsTab: NavigatorScreenParams<AdminStackParamList> | undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  MerchantTabs: NavigatorScreenParams<MerchantTabParamList> | undefined;
  BagDetail: { id: string };
  BagAllergens: { bagId: string };
  /**
   * Stitch `checkout_light_mode_2` renders a logo-centered header variant. Pass
   * `headerVariant: 'logo'` to switch from the default title-bar header.
   */
  Checkout: { draft?: string; headerVariant?: 'title' | 'logo' };
  /** Stitch `order_detail_light_mode_2` logo-centered header variant. */
  OrderDetail: { orderId: string; headerVariant?: 'title' | 'logo' };
  OrderReview: { orderId: string };
  Login: undefined;
  /**
   * Optional `prefill` is a JSON blob populated from `MerchantBagsListScreen` "Duplicate"
   * action. It mirrors the `defaultCreateForm()` shape (string-typed for inputs) so the
   * create screen can hydrate inputs without re-parsing types.
   */
  MerchantBagCreate:
    | {
        prefill?: {
          title?: string;
          description?: string;
          category?: string;
          image_url?: string;
          retail_value_estimate?: string;
          rescue_price?: string;
          quantity_remaining?: string;
        };
      }
    | undefined;
  MerchantBagEdit: { bagId: string };
  MerchantBagsList: undefined;
  MerchantOrderDetail: { orderId: string };
  /** QR / manual code handover for merchant orders tab. */
  MerchantScanHandover: undefined;
  MerchantOnboarding: { step?: string };
  MerchantAnalytics: undefined;
  MerchantFinance: undefined;
  MerchantPayouts: undefined;
  MerchantPayoutDetail: { payoutId: string };
  /**
   * Paginated transaction list scoped to a single settlement period. Reached from
   * `MerchantPayoutDetail` → "View all transactions". Deep link:
   * `freshasever://merchant/payouts/:settlementId/transactions`.
   */
  MerchantPayoutTransactions: { settlementId: string };
  MerchantProfile: undefined;
  /**
   * Per-outlet editor reachable from `MerchantProfile` → "Edit outlets" list. Allows the
   * signed-in merchant to update outlet metadata (name, address, contact phone, category,
   * `is_active`, per-day opening hours, geo location) for a specific outlet they own.
   * Deep link: `freshasever://merchant/outlets/:outletId/edit`.
   */
  MerchantOutletEditor: { outletId: string };
  MerchantSettings: undefined;
  MerchantDisputes: undefined;
  MerchantPromotions: undefined;
  MerchantLiveMonitor: undefined;
  MerchantStaff: undefined;
  Favourites: undefined;
  /**
   * Customer-facing outlet detail. Hero + active bag list + opening hours + directions + a
   * save-to-favourites toggle. Routed from `FavouritesScreen` cards, `SearchResults`, and the
   * Discover surfaces.
   * Deep link: `freshasever://outlet/:outletId`.
   */
  OutletDetail: { outletId: string };
  /**
   * Search results surface reachable from `DiscoverScreen` "See all" CTAs and any search
   * input. Paginated outlet + bag listing with filter chips for category, distance, price and
   * pickup window. Deep link: `freshasever://discover/search`.
   */
  SearchResults:
    | {
        chip?: string;
        query?: string;
      }
    | undefined;
  Impact: undefined;
  ProfileDetails: undefined;
  ProfileSupport: { audience?: 'customer' | 'merchant' } | undefined;
  ProfileNotifications: undefined;
  ProfilePayments: undefined;
  /**
   * User-facing appearance picker. Persists the choice to AsyncStorage under
   * `fae.themePreference.v1`; the `StitchThemeProvider` rehydrates on launch.
   * Deep link: `freshasever://profile/theme`.
   */
  ProfileTheme: undefined;
  WaitlistSuccess: undefined;
  ConnectionError: undefined;
  AdminShell: NavigatorScreenParams<AdminTabParamList> | undefined;
  OrderCelebration: { orderId: string; variant: 'reservation' | 'rescue' };
  SignUp: undefined;
  ForgotPassword: undefined;
  Onboarding: { step?: string };
  /** Stitch `prototype_journey_map` — optional deep-linkable overview */
  BrandJourney: undefined;
};
