# Hosted API (mobile → Next.js backend)

The store app calls the **same** HTTP surface as the Next.js deployment for PayHere signing and return URLs.

## Environment variables (`@env`)

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | Origin of the deployed Next.js app, **no trailing slash**, e.g. `https://staging.freshasever.com` or production host. Used for `POST ${API_BASE_URL}/api/payhere/hash` and webhook path references. |
| `PAYHERE_RETURN_URL_HOST` | Optional. Public origin used in PayHere `return_url` / `cancel_url` when the sandbox should land on a stable web page (defaults to `API_BASE_URL`). |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase project; must match the environment that stores `orders`, `rescue_bags`, `profiles`. |

**Separation:** Point staging mobile builds at staging Supabase + staging `API_BASE_URL`. Production mobile must use production keys and hosts only.

## Location (Discover)

The app calls the same Next.js routes as web discover:

- `GET ${API_BASE_URL}/api/location/search?q=` — area text search (returns `{ results: [{ label, lat, lng }] }`).
- `GET ${API_BASE_URL}/api/location/reverse?lat=&lng=` — optional label for coordinates.

No Supabase keys are required in the app for these; the server may use Google Maps or Nominatim per your deployment env.

## Required server routes

Checkout uses:

- `POST /api/payhere/hash` — body `{ order_id, amount }`; response must include `hash`, `merchant_id`, `amount`, `currency`.

The in-app WebView posts to PayHere sandbox; return URLs should match a host you control so `onNavigationStateChange` can detect `/orders/:id` and navigate to `OrderDetail`.

## Local development

For device/simulator hitting a machine on your LAN, set `API_BASE_URL` to your machine’s LAN IP and ensure the Next.js server accepts that host. Prefer HTTPS staging for real devices when possible.
