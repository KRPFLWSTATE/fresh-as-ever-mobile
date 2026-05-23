# Consistency pass checklist (2026-05-20)

| # | Role | Item | File / surface | Status |
|---|------|------|----------------|--------|
| 1 | All | DB writes use `awaiting_pickup` not `ready_for_pickup` | `orderStatus.ts` | Done |
| 2 | Merchant | `pickupWindow.ts` helpers + tests | `domain/pickupWindow.ts` | Done |
| 3 | Merchant | Tab filter predicates | `merchantOrderFilters.ts` | Done |
| 4 | Merchant | Hook uses filters + RPC collect | `useMerchantOrders.ts` | Done |
| 5 | Merchant | Orders screen tabs + late UI | `MerchantOrdersScreen.tsx` | Done |
| 6 | Merchant | No Confirm pickup bypass | `MerchantOrdersScreen.tsx` | Done |
| 7 | Merchant | 6-character codes | orders, scan, live monitor | Done |
| 8 | Merchant | Live monitor 2h queue | `MerchantLiveMonitorScreen.tsx` | Done |
| 9 | Merchant | Arrival hero | `customer_arrived_at` | Done |
| 10 | Merchant | Order detail handover RPC | `MerchantOrderDetailScreen.tsx` | Done |
| 11 | Merchant | Staff screen | `MerchantStaffScreen.tsx` | Done |
| 12 | Merchant | Active staff gate | `useMerchantContext.ts` | Done |
| 13 | Merchant | Bag form parity | `MerchantBagFormFields.tsx` | Done |
| 14 | Merchant | Onboarding step 3 | `MerchantOnboardingScreen.tsx` | Done |
| 15 | Merchant | Pickup picker full height | `PickupDateTimeField.tsx` | Done |
| 16 | Customer | Discover keyboard sheet | `DiscoverScreen.tsx` | Done |
| 17 | Customer | Geolocation when focused | `useUserLocation.ts` | Done |
| 18 | Customer | I'm at the outlet | `OrderDetailScreen.tsx` | Done |
| 19 | Customer | Orders list arrival hint | `OrdersScreen.tsx` | Done |
| 20 | Customer | Cancel metadata | `OrderDetailScreen.tsx` | Done |
| 21 | Customer | PayHere poll reserved+paid | `OrderDetailScreen.tsx` | Done |
| 22 | All | Support FAQs 25+ | `supportFaqs.ts` | Done |
| 23 | Merchant | ProfileSupport audience | `ProfileSupportScreen.tsx` | Done |
| 24 | Merchant | Settings/Profile help links | settings, profile | Done |
| 25 | All | Deep link `?view=` | `linking.ts` | Done |
| 26 | Web | Merchant orders filters | `fresh-as-ever/.../page.js` | Done |
| 27 | Admin | Open complaint count | `adminComplaints.ts` | Done |
| 28 | Admin | Collect RPC | `adminCollectOrder.ts` | Done |
| 29 | Admin | Orders server search | `AdminStackScreens.tsx` | Done |
| 30 | Admin | Demo KPIs | `useAdminDashboardMetrics.ts` | Done |
| 31 | Admin | Home logout | `AdminStackScreens.tsx` | Done |
| 32 | Ops | Baseline doc | `consistency_pass_baseline.md` | Done |
| 33 | Ops | Handover SQL | `merchant_handover_v1.sql` | Done |
| 34 | Ops | RCT runbook | `RCTDeviceEventEmitter_recovery.md` | Done |
| 35 | Ops | Late pickups spec | `2026-05-20-late-pickups-design.md` | Done |
| 36 | Ops | Phase gates doc | `PHASE_GATES_AND_CHAIN_REACTIONS.md` | Done |
| 37 | Ops | Admin settings doc | `admin-settings-entry.md` | Done |
| 38 | Ops | Matrix updates | `STITCH_VERIFICATION_MATRIX.md` | Done |
| 39 | QA | `npm run ci` | package.json | Done |
| 40 | Bridge | expo-modules-core before AppRegistry | `index.js` | Done |
| 41 | Bridge | No global Keyboard listeners | Discover sheet only | Done |
| 42 | Bridge | Deferred place search focus | `DiscoverScreen.tsx` | Done |
| 43 | Merchant | `reserved`+paid collectible | `isOrderCollectible` | Done |
| 44 | Merchant | Late no-show grace label | late cards | Done |
| 45 | Merchant | Late Verify/Scan actions | late cards | Done |
| 46 | Merchant | Late empty state copy | `MerchantOrdersScreen.tsx` | Done |
| 47 | Merchant | Verification window only | `merchantOrderFilters` | Done |
| 48 | Merchant | Review-pending excludes late/2h | filters | Done |
| 49 | Customer | Arrival 15m pre-window | `isCustomerArrivalEligible` | Done |
| 50 | Customer | Arrival disabled captions | `OrderDetailScreen.tsx` | Done |
| 51 | Merchant | Scan handover route | `MerchantScanHandover` | Done |
| 52 | Merchant | Handover counts | `merchantHandoverCounts.ts` | Done |
| 53 | Web | payment_status in hook | `useMerchantOrders.js` | Done |
| 54 | Web | No inline Mark Collected | `page.js` | Done |
| 55 | Admin | total vs total_amount fix | admin orders | Done |
| 56 | Merchant | Staff modal deprecated path | Settings → Staff screen | Done |
| 57 | Customer | Support email hello@ | `ProfileSupportScreen.tsx` | Done |
| 58 | QA | Late tab test note | baseline doc | Done |
| 59 | QA | Handover smoke doc | `HANDOVER_SMOKE_CHECKLIST.md` | Done |
| 60 | Types | Generated DB types optional | Supabase MCP | Optional |
| 61 | QA | Maestro smoke flows | `.maestro/` | Optional |

## Audit remediation (2026-05-20)

| # | Role | Item | Surface | Status |
|---|------|------|---------|--------|
| R1 | Web | `merchant_collect_order` RPC only | `useMerchantOrders.js`, order detail | Done |
| R2 | Web | No dispute collect bypass | `merchant/disputes/page.js` | Done |
| R3 | Web | `pickupWindow.js` + `merchantOrderFilters.js` | `src/lib/` | Done |
| R4 | Web | Lint-safe `nowMs` tick | `merchant/orders/page.js` | Done |
| R5 | Web | Customer arrival CTA | `useOrderDetail.js`, customer order detail | Done |
| R6 | Web | Live monitor arrival hero/badge | `merchant/orders/page.js` | Done |
| R7 | Web | Admin orders Supabase + pagination | `useAdminOrders.js`, `admin/orders/page.js` | Done |
| R8 | Web | `admin_collect_order` RPC | `adminCollectOrder.js` | Done |
| R9 | Mobile | Scan `maxLength=6` | `MerchantScanHandoverScreen.tsx` | Done |
| R10 | Mobile | Admin collect no DB fallback | `adminCollectOrder.ts` | Done |
| R11 | Ops | HANDOVER + matrix + baseline docs | `docs/` | Done |

## Perfection pass (2026-05-20)

| Area | Evidence |
|------|----------|
| Protocol | `supabaseError.ts` (mobile/web), `FROZEN_GOLDEN_PATHS.md`, `PERFECTION_PASS_*` docs |
| DB | Migrations `perfection_pass_inventory_v2`, `perfection_pass_audit_extend` applied |
| Analytics | `useMerchantAnalytics` + tests; web/mobile analytics pages |
| Admin web | Live dashboard, merchants, complaints, audit logs, CSV export |
| Customer | Web QR (`OrderPickupQr`), payment history, live `promo_codes` checkout |
| CI | Mobile `npm run ci` 73 tests; web lint (0 errors) + build |
