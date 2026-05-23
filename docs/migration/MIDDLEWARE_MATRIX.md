# Middleware → React Navigation parity matrix

Source: [`fresh-as-ever/src/middleware.js`](../../../../fresh-as-ever/src/middleware.js)

## Direct path aliases (canonical redirects)

| Incoming path | Target | RN deep link / screen mapping notes |
|---------------|--------|-------------------------------------|
| `/auth/login` | `/login` | `Login` stack; prefix `https://` + custom scheme |
| `/merchant` | `/merchant/dashboard` | `MerchantDashboard` |
| `/admin` | `/admin/dashboard` | `AdminDashboard` (defer v1 — see `docs/migration/ADMIN_DEFER.md`) |
| `/onboarding/step-1` | `/onboarding?step=1` | `Onboarding` params `step=1` |
| `/onboarding/step-2` | `/onboarding?step=2` | `step=2` |
| `/onboarding/step-3` | `/onboarding?step=3` | `step=3` |
| `/merchant/onboarding/step-1` | `/merchant/onboarding?step=1` | Merchant onboarding |
| `/merchant/onboarding/step-2` | `?step=2` | |
| `/merchant/onboarding/step-3` | `?step=3` | |
| `/merchant/onboarding/step-4` | `?step=3` | Alias to step 3 |
| `/merchant/bags/new` | `/merchant/bags/create` | `MerchantBagCreate` |
| `/support` | `/profile/support` | `ProfileSupport` |
| `/profile/edit` | `/profile/details` | `ProfileDetails` |
| `/discover/empty-search` | `/discover?state=empty-search` | `Discover` query |
| `/discover/no-results` | `/discover?state=no-results` | |
| `/discover/no-bags-nearby` | `/discover?state=no-bags-nearby` | |
| `/discover/sold-out` | `/discover?state=sold-out` | |

## Regex redirects

| Pattern | Target | RN params |
|---------|--------|-----------|
| `^/bag/([^/]+)$` | `/bags/:id` | `bagId` |
| `^/merchant/finance/payout/([^/]+)$` | `/merchant/payouts/:id` | `payoutId` |
| `^/checkout/([^/]+)$` | `/checkout?draft=:id` | `draft` |
| `^/reservation/success/([^/]+)$` | `/orders/:id` | `orderId` |
| `^/rescue/confirmed/([^/]+)$` | `/orders/:id` | `orderId` |

## Public paths (no login required)

Prefixes / exact: `/`, `/api/location*`, `/auth*`, `/login`, `/bag/*`, `/discover*`, `/bags*`, `/waitlist*`, `/onboarding*`, `/merchant/onboarding`, `/loading*`, `/state*`, `/error*`, `/prototype*`.

**RN:** replicate in `linking` + guard so unauthenticated users never reach protected stacks; public list must stay in sync when web middleware changes.

## RBAC (authenticated)

| Rule | Web behavior | RN behavior |
|------|--------------|-------------|
| No user + not public | Redirect `/login` | Reset to `Login` / block stack |
| Suspended customer + `/checkout*` | Redirect `/profile?suspended=1` | Navigate `Profile` + `suspended=1` |
| Logged-in on `/login` | Role home: admin → admin dashboard, merchant → merchant dashboard, else discover | Replace with same role resolution |
| `/admin*` | `role === admin` | Non-admin → Discover |
| `/merchant*` except `/merchant/onboarding` | `merchant_staff` or `admin` | Else → Discover |
| QA emails | `qa.admin@…` → admin, `qa.merchant@…` → merchant_staff | Mirror in `AuthContext` |

Profile role source: `profiles.role`, `profiles.is_suspended`; fallback `user.app_metadata.role`, `qa.*` override.
