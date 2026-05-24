# Transactional SMS (Twilio + Supabase Edge Function)

Fresh As Ever mobile **persists SMS preferences** on `profiles.notification_prefs` and requires a **phone number** on the profile before enabling SMS alerts. Outbound transactional SMS is delivered via **Twilio** through the Supabase Edge Function `send-transactional-sms`.

## Supabase secrets (Edge Function)

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets (or `supabase secrets set`):

| Secret | Purpose |
|--------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_FROM_NUMBER` | E.164 sender (LK-capable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service role (auto-injected on some projects) |
| `SUPABASE_SECRET_KEYS` | New default JSON bundle — Edge Function reads `service_role` from this with fallback to `SUPABASE_SERVICE_ROLE_KEY` |

`SUPABASE_URL` is provided automatically in the Edge runtime.

## Deploy

From the **web** repo (`fresh-as-ever`):

```bash
supabase functions deploy send-transactional-sms --project-ref odkbpeelvcdmlimdflbr --no-verify-jwt
```

## Vercel triggers (v1)

| Event | Caller |
|-------|--------|
| Reservation confirmed (`paid`) | `POST /api/payhere/webhook` → `invokeTransactionalSms` |
| Pickup reminder (~30–60 min before window) | **Vercel Cron** `GET /api/cron/pickup-reminders` every 15 min (`vercel.json`) |

Handover-code SMS is deferred (QR in-app is primary).

### Pickup reminder cron env (Vercel)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer token for manual/cron auth |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` | Query orders + invoke Edge Function |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |

Vercel scheduled invocations send `x-vercel-cron: 1`; the route also accepts `Authorization: Bearer <CRON_SECRET>` for manual runs.

Idempotency: `orders.pickup_reminder_sent_at` is set after a successful invoke (skipped SMS still marks sent to avoid retry storms — adjust if you need retries).

## Auth OTP vs transactional

- **Supabase Auth OTP** — configured separately in Supabase Auth → Phone (may use Twilio or another provider).
- **Transactional SMS** — this Edge Function only; respects `notification_prefs.sms`.

## Test checklist

1. Profile phone + SMS toggle on (`/profile/notifications` web + mobile).
2. Sandbox PayHere payment → webhook → SMS received (or `{ skipped: true }` in logs if Twilio unset).
3. Toggle SMS off → no send (`skipped: sms_disabled_or_no_phone`).
4. Pickup cron: set a bag `pickup_start` 45 minutes ahead, run `curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-host>/api/cron/pickup-reminders`.

## Templates

| `template` | Copy |
|------------|------|
| `reservation_confirmed` | Rescue bag reserved + reservation code |
| `pickup_reminder` | Pickup window starting + ref |

## Not in v1

Push (FCM/APNs), email — future Phase 4b.

## Alternative: pg_cron + pg_net

See `docs/supabase/pickup_sms_cron.sql`. On project `odkbpeelvcdmlimdflbr`, `pg_cron` is installed; `pg_net` is not — enable in Dashboard if you want DB-native HTTP instead of Vercel Cron.
