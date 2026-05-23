# Hosted API secrets rotation (**§ `hosted-api-multi-env-secrets-drill-ant`**)

PayHere merchant secret + GEO API keys rotate **without** rebuilding mobile binaries:

1. Rotate secret in Vercel / Next env staging.
2. Confirm `/api/payhere/hash` + `/api/geo/*` health from device hitting `API_BASE_URL`.
3. Mobile `.env` only stores **public URLs** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`) — anon key rotation still requires reinstall.
