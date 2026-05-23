# Supabase Auth — dashboard checklist

Manual steps (not in repo code):

1. **Leaked password protection** — Dashboard → Authentication → Providers → Email → enable **Prevent the use of leaked passwords** (HaveIBeenPwned).
2. **Site URL + redirects** — Match deployed web origin and `freshasever://auth/callback` (see `docs/SOCIAL_AUTH_SETUP.md`).
3. **Twilio (optional)** — Phone OTP only if using Supabase phone auth; transactional SMS uses Edge Function + Twilio secrets (see `docs/SMS_TRANSACTIONAL.md`).
