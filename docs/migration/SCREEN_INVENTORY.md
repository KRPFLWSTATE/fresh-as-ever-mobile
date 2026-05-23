# Screen inventory (Next `page.js` → RN route)

## RN parity snapshot (plan **`p0-inv-pages-every-route`**)

| Band | Notes |
|------|--------|
| **SHIP / STUB** | Customer shells + Checkout + Merchant CRUD/views + stubs (finance/payouts…); see `src/navigation/` and `screens/`. |
| **ADMIN (parity)** | `AdminShell` stack under `admin/*` — see `ADMIN_DEFER.md` and `PHASE10_ADMIN_ARCHITECTURE.md`. |
| **Web-only landing** | `C_HOME` `/` stays on web PWA; RN cold-start → **`MainTabs`**. Legacy `/bag/*`, `/merchant/finance/payout/*` → `normalizeIncomingLinkPath.ts` + linking. |

60 routes under `fresh-as-ever/src/app`. Suggested **Screen ID** and **RN route name** for linking.

| Screen ID | Next path (App Router) | RN route | Auth | Notes |
|-----------|------------------------|----------|------|-------|
| C_HOME | `/page.js` | `Home` | public | Marketing / entry |
| C_WAITLIST_OK | `/waitlist/success` | `WaitlistSuccess` | public | |
| C_LOADING_SPLASH | `/loading/splash` | `LoadingSplash` | public | |
| C_ERR_CONNECTION | `/error/connection` | `ErrorConnection` | public | |
| C_STATE_SKEL_DISCOVER | `/state/skeleton/discover` | `StateDiscoverSkeleton` | optional | |
| C_STATE_SOLDOUT | `/state/sold-out` | `StateSoldOut` | optional | |
| C_PROTO_JOURNEY | `/prototype/journey-map` | `PrototypeJourneyMap` | defer v1 | |
| C_AUTH_LOGIN_PAREN | `/(auth)/login` | `Login` | public | Merge with login |
| C_AUTH_LOGIN_ALT | `/auth/login` | `Login` | public | Alias |
| C_LOGIN | `/login` | `Login` | public | |
| C_ONBOARD | `/(customer)/onboarding` | `Onboarding` | public | query step |
| OBD_S1 | `/onboarding/step-1` | redirects | | middleware |
| OBD_S2 | `/onboarding/step-2` | redirects | | |
| OBD_S3 | `/onboarding/step-3` | redirects | | |
| C_DISCOVER | `/(customer)/discover` | `Discover` | public | state query |
| C_BAGS_DETAIL | `/(customer)/bags/[id]` | `BagDetail` | public | param id |
| BAG_LEGACY | `/bag/[bagId]` + allergens | `BagDetail` / `BagAllergens` | public | |
| C_CHECKOUT | `/(customer)/checkout` | `Checkout` | customer | draft query; suspended block |
| C_ORDERS | `/(customer)/orders` | `Orders` | customer | |
| C_ORDER_DETAIL | `/(customer)/orders/[id]` | `OrderDetail` | customer | |
| C_ORDER_REVIEW | `/(customer)/orders/[id]/review` | `OrderReview` | customer | |
| C_FAVOURITES | `/(customer)/favourites` | `Favourites` | customer | |
| C_IMPACT | `/(customer)/impact` | `Impact` | customer | |
| C_PROFILE | `/(customer)/profile` | `Profile` | customer | |
| C_PROFILE_DETAILS | `/(customer)/profile/details` | `ProfileDetails` | customer | |
| C_PROFILE_NOTIFICATIONS | `/(customer)/profile/notifications` | `ProfileNotifications` | customer | |
| C_PROFILE_PAYMENTS | `/(customer)/profile/payments` | `ProfilePayments` | customer | |
| C_PROFILE_SUPPORT | `/(customer)/profile/support` | `ProfileSupport` | customer | |
| M_DASHBOARD | `/(merchant)/merchant/dashboard` | `MerchantDashboard` | merchant/admin | |
| M_ONBOARDING | `/(merchant)/merchant/onboarding` | `MerchantOnboarding` | merchant | |
| M_ANALYTICS | `/(merchant)/merchant/analytics` | `MerchantAnalytics` | merchant/admin | |
| M_BAGS | `/(merchant)/merchant/bags` | `MerchantBags` | merchant/admin | |
| M_BAGS_CREATE | `/(merchant)/merchant/bags/create` | `MerchantBagCreate` | merchant/admin | alias /new |
| M_BAGS_EDIT | `/(merchant)/merchant/bags/[id]/edit` | `MerchantBagEdit` | merchant/admin | |
| M_ORDERS | `/(merchant)/merchant/orders` | `MerchantOrders` | merchant/admin | |
| M_ORDER_DETAIL | `/(merchant)/merchant/orders/[id]` | `MerchantOrderDetail` | merchant/admin | |
| M_ORDERS_LATE | `/(merchant)/merchant/orders/late-pickups` | `MerchantLatePickups` | merchant/admin | |
| M_ORDERS_VERIFY | `/(merchant)/merchant/orders/verification` | `MerchantVerification` | merchant/admin | |
| M_ORDERS_REVIEW | `/(merchant)/merchant/orders/review-pending` | `MerchantReviewPending` | merchant/admin | |
| M_DISPUTES | `/(merchant)/merchant/disputes` | `MerchantDisputes` | merchant/admin | |
| M_FINANCE | `/(merchant)/merchant/finance` | `MerchantFinance` | merchant/admin | |
| M_PROMOTIONS | `/(merchant)/merchant/promotions` | `MerchantPromotions` | merchant/admin | |
| M_PAYOUTS | `/(merchant)/merchant/payouts` | `MerchantPayouts` | merchant/admin | |
| M_PAYOUT_DETAIL | `/(merchant)/merchant/payouts/[id]` | `MerchantPayoutDetail` | merchant/admin | |
| M_FINANCE_PAYOUT_LEGACY | `/merchant/finance/payout/[payoutId]` | redirect | | |
| M_PROFILE | `/(merchant)/merchant/profile` | `MerchantProfile` | merchant/admin | |
| M_SETTINGS | `/(merchant)/merchant/settings` | `MerchantSettings` | merchant/admin | |
| M_LIVE_MONITOR | `/(merchant)/merchant/live-monitor` | `MerchantLiveMonitor` | merchant/admin | |
| M_BAG_NEW_LEGACY | `/merchant/bags/new` | redirect | | |
| A_DASHBOARD | `/(admin)/admin/dashboard` | `AdminDashboard` | admin | DEFER v1 |
| A_DASHBOARD_COLOMBO | `/(admin)/admin/dashboard/colombo` | `AdminDashboardColombo` | admin | DEFER |
| A_MERCHANTS | `/(admin)/admin/merchants` | `AdminMerchants` | admin | DEFER |
| A_MERCHANT_DETAIL | `/(admin)/admin/merchants/[id]` | `AdminMerchantDetail` | admin | DEFER |
| A_MERCHANT_REVIEW | `/(admin)/admin/merchants/[id]/review` | `AdminMerchantReview` | admin | DEFER |
| A_ORDERS | `/(admin)/admin/orders` | `AdminOrders` | admin | DEFER |
| A_PROMOS | `/(admin)/admin/promos` | `AdminPromos` | admin | DEFER |
| A_COMPLAINTS | `/(admin)/admin/complaints` | `AdminComplaints` | admin | DEFER |
| A_SETTLEMENTS | `/(admin)/admin/settlements` | `AdminSettlements` | admin | DEFER |
| A_AUDIT | `/(admin)/admin/audit-logs` | `AdminAuditLogs` | admin | DEFER |
| A_SETTINGS | `/(admin)/admin/settings` | `AdminSettings` | admin | DEFER |

**DEFER:** Full admin UI parity is phase 2 unless product says otherwise (`docs/migration/ADMIN_DEFER.md`).
