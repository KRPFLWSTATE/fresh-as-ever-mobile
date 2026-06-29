# Pass 26 — Sri Lanka Expansion QA Credentials

Inherited from Pass 25 unless noted. Supabase project: `odkbpeelvcdmlimdflbr`.

## Accounts

| Account | Password | Role | Outlets / scope |
|---------|----------|------|-----------------|
| `qa.customer@freshasever.test` | `TempCustomer#12345` | Customer mobile + web | Discover, orders, impact |
| `qa.merchant@freshasever.test` | `TempMerchant#12345` | Merchant Bakehouse | Kollupitiya (`00000000-0000-0000-0000-000000000003`) + Galle Face (`b4884c9f-5a7c-41b0-af19-321c66f24dea`) |
| `qa.kumbuk@freshasever.test` | `TempMerchant#12345` | Merchant Kumbuk | Colombo 07 (`00000000-0000-0000-0000-000000000013`) + Pettah (`8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4`) |
| `qa.admin@freshasever.test` | `TempAdmin#12345` | Web admin | `/admin/*` seasonal windows, merchants, orders |

## Login testIDs (mobile)

- Customer: `login.email`, `login.password`, `login.signIn`, `login.portal.customer`
- Merchant: `login.email`, `login.password`, `login.signIn`, `login.portal.merchant`
- Deeplink: `freshasever://login?portal=merchant`

## Device / sim

- **UDID:** `377DAC99-B79C-4B05-BB34-DBA1D160038D` (iPhone 17 Pro)
- **Geolocation:** Colombo `6.9147, 79.8655`
- **Appium:** WebdriverIO `:4723` + Official Appium MCP fallback
- **Bundle:** `com.freshasever.mobile`

## Pass 26 feature flags (default OFF)

Enable locally for stream QA only; integration branch enables all before marathon.

| Flag key | Mobile env | Web env | Gates |
|----------|------------|---------|-------|
| `PICKUP_WINDOW_PRESETS` | `EXPO_PUBLIC_PICKUP_WINDOW_PRESETS=false` | `NEXT_PUBLIC_PICKUP_WINDOW_PRESETS=false` | F1 merchant + discover |
| `LISTING_WHATSAPP_SHARE` | `EXPO_PUBLIC_LISTING_WHATSAPP_SHARE=false` | `NEXT_PUBLIC_LISTING_WHATSAPP_SHARE=false` | F2 share buttons |
| `NEIGHBOURHOOD_BROWSE` | `EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE=false` | `NEXT_PUBLIC_NEIGHBOURHOOD_BROWSE=false` | F3 cards + filter |
| `SEASONAL_BADGES` | `EXPO_PUBLIC_SEASONAL_BADGES=false` | `NEXT_PUBLIC_SEASONAL_BADGES=false` | F4 tags + filter |
| `ON_MY_WAY` | `EXPO_PUBLIC_ON_MY_WAY=false` | `NEXT_PUBLIC_ON_MY_WAY=false` | F5 customer + merchant |
| `MONTHLY_SAVINGS_PUSH` | `EXPO_PUBLIC_MONTHLY_SAVINGS_PUSH=false` | `MONTHLY_SAVINGS_PUSH=false` (server) | F6/F7 cron + push |

**Resolver modules:** `fresh-as-ever-mobile/src/config/featureFlags.ts`, `fresh-as-ever/src/config/featureFlags.js`

## Integration QA flags

Enabled on branch `feature/pass26-expansion` for marathon QA (`.env.example` remains `false`).

| Flag key | Mobile (`.env`) | Web (`.env.local`) | Cron / server |
|----------|-----------------|--------------------|---------------|
| `PICKUP_WINDOW_PRESETS` | `true` | `true` | — |
| `LISTING_WHATSAPP_SHARE` | `true` | `true` | — |
| `NEIGHBOURHOOD_BROWSE` | `true` | `true` | — |
| `SEASONAL_BADGES` | `true` | `true` | — |
| `ON_MY_WAY` | `true` | `true` | — |
| `MONTHLY_SAVINGS_PUSH` | `true` | — | `MONTHLY_SAVINGS_PUSH=true` |

Restart Metro / Next dev server after changing env. Set `MONTHLY_SAVINGS_PUSH=true` in Vercel project env for deployed cron.

## Baseline snapshot

Pre-migration baseline: [`baseline/pre-migration.json`](./baseline/pre-migration.json) — landmark fill rate, demo outlet listing counts, `customer_arrived_at` orders, Appium/Xcode P0 gate.

Legacy snapshot: [`baseline/pre-pass26.json`](./baseline/pre-pass26.json) (2026-06-18, pre-landmark backfill).

## Merchant Orders scenario seed (WS1)

Refreshed by `npm run refresh-demo` → [`refresh-demo-listings.mjs`](../refresh-demo-listings.mjs).  
Customer: `qa.customer@freshasever.test` (`571aadc0-d2e6-43bf-bab7-03a35ce3ef7f`).

### Scenario windows (relative to seeder run time)

| Kind | Window | Merchant sub-tab |
|------|--------|------------------|
| `IN_WINDOW_WIDE` | now−1h → now+6h | Verification (Ready now) |
| `ENDING_SOON` | now−30m → now+90m | Live monitor (Ending soon) |
| `LATE_RECENT` | now−90m → now−10m | Late pickups — recent |
| `LATE_CRITICAL` | now−3h → now−45m | Late pickups — critical / no-show eligible |
| `FUTURE` | now+3h → now+7h | Review pending (not started) |

Discover bags (`…004`, `…014`, `…105`, Pettah `87e99daa…`) keep `IN_WINDOW_WIDE` or `ENDING_SOON` so customer Discover stays usable. Past-window scenario bags (`…101`, `…102`) are excluded from Discover (`pickup_end < now`).

### Scenario bags (`QA_SCENARIO_BAGS`)

| Scenario | Bag ID | Outlet | Merchant login |
|----------|--------|--------|----------------|
| `IN_WINDOW_WIDE` | `00000000-0000-0000-0000-000000000004` | Bakehouse Kollupitiya | `qa.merchant@freshasever.test` |
| `ENDING_SOON` | `00000000-0000-0000-0000-000000000014` | Bakehouse Kollupitiya | `qa.merchant@freshasever.test` |
| `LATE_RECENT` | `00000000-0000-0000-0000-000000000101` | Bakehouse Kollupitiya | `qa.merchant@freshasever.test` |
| `LATE_CRITICAL` | `00000000-0000-0000-0000-000000000102` | Kumbuk Colombo 07 | `qa.kumbuk@freshasever.test` |
| `FUTURE` | `00000000-0000-0000-0000-000000000103` | Kumbuk Colombo 07 | `qa.kumbuk@freshasever.test` |

Shelves: Bakehouse `…201` → `FUTURE`; Pettah `87e99daa…d3` → `IN_WINDOW_WIDE`.

### Scenario orders (`QA_SCENARIO_ORDERS`)

| Scenario | Order ID | Bag | `order_status` | `payment_status` | Code | Tab |
|----------|----------|-----|----------------|-------------------|------|-----|
| `IN_WINDOW_WIDE` | `a1ba7758-7290-4ece-804d-15585f7da9eb` | `…004` | `reserved` | `paid` | `UQV76C` | verification |
| `ENDING_SOON` | `00000000-0000-0000-0000-000000000301` | `…014` | `reserved` | `paid` | `END2HR` | live-monitor |
| `LATE_RECENT` | `00000000-0000-0000-0000-000000000302` | `…101` | `reserved` | `paid` | `LATREC` | late-pickups |
| `LATE_CRITICAL` | `00000000-0000-0000-0000-000000000303` | `…102` | `reserved` | `paid` | `LATCRT` | late-pickups |
| `FUTURE` (unpaid) | `00000000-0000-0000-0000-000000000304` | `…103` | `reserved` | `pending` | `FUTURE` | review-pending |

### Scenario group (`QA_SCENARIO_GROUP`)

| Field | Value |
|-------|-------|
| Group ID | `00000000-0000-0000-0000-000000000400` |
| Code | `DV387Y` |
| Outlet | Bakehouse Kollupitiya |
| Child orders | `…321` (bag `…004`) + `…322` (bag `…014`) |
| Status | `reserved` / `paid` — reset idempotently by seeder |

Deeplinks: `freshasever://orders/<order_id>`. F5 baseline: [`baseline/f5-test-order.json`](./baseline/f5-test-order.json).
