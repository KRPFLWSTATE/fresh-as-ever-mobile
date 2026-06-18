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
