import type { LinkingOptions } from '@react-navigation/native';
import { getStateFromPath as getStateFromPathCore } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { normalizeIncomingLinkPath } from '@/navigation/normalizeIncomingLinkPath';

const prefixes = [
  'freshasever://',
  'https://freshasever.com',
  'https://www.freshasever.com',
];

const config: NonNullable<LinkingOptions<RootStackParamList>['config']> = {
  screens: {
    MainTabs: {
      screens: {
        DiscoverTab: {
          path: 'discover',
          parse: {
            state: (v: unknown) =>
              typeof v === 'string' ? v.trim().toLowerCase() : undefined,
          },
        },
        OrdersTab: 'orders',
        FavouritesTab: 'tabs/favourites',
        ProfileTab: {
          path: 'profile',
          parse: {
            suspended: (s: unknown) =>
              typeof s === 'string' ? s : undefined,
            headerVariant: (v: unknown) => (v === 'logo' ? 'logo' : 'title'),
          },
        },
      },
    },
    MerchantTabs: {
      screens: {
        MerchantDashTab: 'merchant/dashboard',
        MerchantOrdersTab: {
          path: 'merchant/orders',
          parse: {
            view: (v: unknown) => {
              const s = typeof v === 'string' ? v.trim() : '';
              const allowed = [
                'all',
                'verification',
                'review-pending',
                'late-pickups',
                'live-monitor',
              ] as const;
              return (allowed as readonly string[]).includes(s)
                ? (s as (typeof allowed)[number])
                : undefined;
            },
          },
        },
        MerchantBagsTab: 'merchant/tabs/bags',
        MerchantSettingsTab: 'merchant/tabs/settings',
      },
    },
    BagAllergens: {
      path: 'bags/:bagId/allergens',
      parse: { bagId: (id: string) => id },
    },
    BagDetail: {
      path: 'bags/:id',
      parse: { id: (id: string) => id },
    },
    Checkout: {
      path: 'checkout',
      parse: {
        draft: (d: string) => d ?? undefined,
        headerVariant: (v: unknown) => (v === 'logo' ? 'logo' : 'title'),
      },
    },
    OrderReview: {
      path: 'orders/:orderId/review',
      parse: { orderId: (o: string) => o },
    },
    OrderDetail: {
      path: 'orders/:orderId',
      parse: {
        orderId: (o: string) => o,
        headerVariant: (v: unknown) => (v === 'logo' ? 'logo' : 'title'),
      },
    },
    Login: 'login',
    MerchantBagCreate: 'merchant/bags/create',
    MerchantBagEdit: {
      path: 'merchant/bags/:bagId/edit',
      parse: { bagId: (id: string) => id },
    },
    MerchantBagsList: 'merchant/bags',
    MerchantOrderDetail: {
      path: 'merchant/orders/:orderId',
      parse: { orderId: (o: string) => o },
    },
    MerchantScanHandover: 'merchant/orders/scan',
    MerchantOnboarding: {
      path: 'merchant/onboarding',
      parse: {
        step: (s: unknown) =>
          typeof s === 'string' && s.length > 0 ? s : undefined,
      },
    },
    MerchantAnalytics: 'merchant/analytics',
    MerchantFinance: 'merchant/finance',
    MerchantPayouts: 'merchant/payouts',
    MerchantPayoutDetail: {
      path: 'merchant/payouts/:payoutId',
      parse: { payoutId: (id: string) => id },
    },
    MerchantPayoutTransactions: {
      path: 'merchant/payouts/:settlementId/transactions',
      parse: { settlementId: (id: string) => id },
    },
    MerchantProfile: 'merchant/profile',
    MerchantOutletEditor: {
      path: 'merchant/outlets/:outletId/edit',
      parse: { outletId: (id: string) => id },
    },
    MerchantSettings: 'merchant/settings',
    MerchantDisputes: 'merchant/disputes',
    MerchantPromotions: 'merchant/promotions',
    MerchantLiveMonitor: 'merchant/live-monitor',
    MerchantStaff: 'merchant/staff',
    Favourites: 'favourites',
    OutletDetail: {
      path: 'outlet/:outletId',
      parse: { outletId: (id: string) => id },
    },
    SearchResults: {
      path: 'discover/search',
      parse: {
        chip: (c: unknown) => (typeof c === 'string' ? c : undefined),
        query: (q: unknown) => (typeof q === 'string' ? q : undefined),
      },
    },
    Impact: 'impact',
    ProfileDetails: 'profile/details',
    ProfileNotifications: 'profile/notifications',
    ProfilePayments: 'profile/payments',
    ProfileSupport: {
      path: 'profile/support',
      parse: {
        audience: (a: unknown) =>
          a === 'merchant' ? 'merchant' : a === 'customer' ? 'customer' : undefined,
      },
    },
    ProfileTheme: 'profile/theme',
    WaitlistSuccess: 'waitlist/success',
    ConnectionError: 'error/connection',
    AdminShell: {
      path: 'admin',
      screens: {
        AdminDashTab: {
          screens: {
            AdminHome: 'dashboard',
            AdminSettlements: 'settlements',
            AdminSettlementDetail: {
              path: 'settlements/:settlementId',
              parse: { settlementId: (id: string) => id },
            },
            AdminComplaints: 'complaints',
            AdminComplaintDetail: {
              path: 'complaints/:complaintId',
              parse: { complaintId: (id: string) => id },
            },
            AdminAuditLogs: 'audit-logs',
            AdminPromosAdmin: 'promos',
            AdminSystemSettings: 'settings',
            AdminApplicationReview: 'merchants/review',
          },
        },
        AdminOrdersTab: {
          screens: {
            AdminPlatformOrders: {
              path: 'orders',
              parse: {
                day: (d: unknown) =>
                  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
                    ? d
                    : undefined,
              },
            },
            AdminPlatformOrderDetail: {
              path: 'orders/:orderId',
              parse: { orderId: (o: string) => o },
            },
          },
        },
        AdminMerchantsTab: {
          screens: {
            AdminMerchants: 'merchants',
            AdminMerchantDetail: {
              path: 'merchants/:merchantId',
              parse: { merchantId: (id: string) => id },
            },
          },
        },
        AdminSettingsTab: {
          screens: {
            AdminPlatformConfig: 'configuration',
          },
        },
      },
    },
    OrderCelebration: {
      path: 'order-celebration',
      parse: {
        orderId: (o: string) => String(o),
        variant: (v: unknown) =>
          v === 'rescue' ? 'rescue' : 'reservation',
      },
    },
    SignUp: 'sign-up',
    ForgotPassword: 'forgot-password',
    Onboarding: {
      path: 'onboarding',
      parse: {
        step: (s: unknown) =>
          typeof s === 'string' && s.length > 0 ? s : undefined,
      },
    },
    BrandJourney: 'journey',
  },
};

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes,
  config,
  getStateFromPath(path, options) {
    const canonical = normalizeIncomingLinkPath(path);
    return getStateFromPathCore<RootStackParamList>(canonical, {
      ...(options ?? {}),
      screens: config.screens,
    });
  },
};
