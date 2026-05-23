# Supabase Auth — dashboard checklist

Manual steps (not in repo code):

1. **Leaked password protection** — Requires a **Supabase plan upgrade** on this project. After upgrade: Dashboard → Authentication → Providers → Email → enable **Prevent the use of leaked passwords** (HaveIBeenPwned). Until then, the security advisor will report `auth_leaked_password_protection` as a warning.
2. **Site URL + redirects** — Match deployed web origin and `freshasever://auth/callback` (see `docs/SOCIAL_AUTH_SETUP.md`).
3. **Twilio (transactional SMS)** — Set Edge Function secrets on project **Fresh As Ever** (`odkbpeelvcdmlimdflbr`): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Function `send-transactional-sms` is deployed (v2). See `docs/SMS_TRANSACTIONAL.md`.
4. **Phone OTP (optional)** — Separate from transactional SMS; configure in Auth → Phone if using Supabase phone sign-in.

## Applied via Supabase MCP (2026-05-24)

- Migration `payhere_payment_id_and_merchant_notes` — columns on `orders` / `complaints`
- Migration `merchant_complaints_rls_and_rpcs` — merchant update policy + dashboard RPCs
- Migration `revoke_anon_execute_merchant_rpcs` — anon cannot call merchant aggregate RPCs
- Edge Function `send-transactional-sms` deployed (service-role auth, JWT verify off)
