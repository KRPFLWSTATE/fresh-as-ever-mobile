# Hooks inventory (`fresh-as-ever/src/hooks` → RN)

| Hook | Role | RN strategy | RN artifact (`p0-inv-hooks-per-file-owner`) |
|------|------|-------------|-----------------------------------------------|
| `useAuth.js` | Auth, role, QA overrides | Middleware parity + QA emails | `src/context/AuthContext.tsx` |
| `useDiscoverBags.js` | Geo, nearby bags | Nearby RPC via hosted geo | `src/hooks/useNearbyBags.ts` + `DiscoverScreen` |
| `useCheckout.js` | Checkout, PayHere | Inline screen state + hash POST | `src/screens/CheckoutScreen.tsx` (+ future `useCheckout.ts`) |
| `useOrders.js` | Orders list | PostgREST | `src/screens/OrdersScreen.tsx` |
| `useOrderDetail.js` | Order row | Inline + shared status helpers | `src/screens/OrderDetailScreen.tsx` |
| `useBagDetail.js` | Bag realtime | Cleanup on unmount | `src/screens/BagDetailScreen.tsx` |
| `useFavourites.js` | Saves | Optimistic toggle | `src/hooks/useFavourites.ts` |
| `usePaymentMethods.js` | Metadata cards | Async user_metadata | `src/hooks/usePaymentMethods.ts` |
| `useCustomerImpact.js` | Impact | Supabase rollup | `src/hooks/useCustomerImpact.ts` |
| `useMerchantContext.js` | Outlet scope | First-class dependency | `src/hooks/useMerchantContext.ts` |
| `useMerchantBags.js` | CRUD | Forms | `MerchantBag*Screen` + hook |
| `useMerchantOrders.js` | Merchant orders | Filters | `src/hooks/useMerchantOrders.ts` |
| `useMerchantDashboard.js` | KPIs | Aggregate | `src/hooks/useMerchantDashboard.ts` |
| `useMerchantFinance.js` | Finance | Outlet filters | `src/hooks/useMerchantFinance.ts` |
| `useMerchantReviews.js` | Reviews | Outlet scope list | `src/hooks/useMerchantReviews.ts` |

Dependency order: **useAuth** → **useMerchantContext** → feature hooks → checkout/discover.

### Parity probes

- Nearby counts harness & cache notes: `docs/investigations/p4-hooks-parity-harness.md`.
- Impact invalidation parity: tracked in same doc (invalidate matrix stub).
