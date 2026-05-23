# Hosted API (Next Route Handlers)

Mobile calls **absolute HTTPS** — never embed PayHere secrets.

| Route | Method | Purpose | RN usage |
|-------|--------|---------|----------|
| `/api/location/search` | GET | Geo search proxy | Discover / address |
| `/api/location/reverse` | GET | Reverse geocode | |
| `/api/payhere/hash` | POST | Server-signed payment hash | Checkout — open browser / WebView after response |
| `/api/payhere/webhook` | POST | PayHere server callbacks | **Never** from app — server only |
| Next **Server Actions** (implicit) | n/a | Web-only UX entry points | Explicit RN equivalents = hosted handlers above (`p0-inv-server-actions-if-any-client-triggers-ant`) |

Configure `API_BASE_URL` in `.env` (see `.env.example`). Multi-env secret rotation playbook: `docs/investigations/HOSTED_API_SECRETS_DRILL.md`.
