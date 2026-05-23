# Transactional SMS (Twilio + Supabase Edge Function)

Fresh As Ever mobile **persists SMS preferences** on `profiles.notification_prefs` and requires a **phone number** on the profile before enabling SMS alerts. Outbound transactional SMS is delivered via **Twilio** through the Supabase Edge Function `send-transactional-sms`.

## Supabase secrets (Edge Function)

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets (or `supabase secrets set`):

| Secret | Purpose |
|--------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth |
| `TWILIO_FROM_NUMBER` | E.164 sender (LK-capable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected in hosted functions |

`SUPABASE_URL` is provided automatically in the Edge runtime.

## Deploy

From the **web** repo (`fresh-as-ever`):

```bash
supabase functions deploy send-transactional-sms --project-ref YOUR_PROJECT_REF
```

## Vercel triggers (v1)

| Event | Caller |
|-------|--------|
| Reservation confirmed (`paid`) | `POST /api/payhere/webhook` → `invokeTransactionalSms` |
| Pickup reminder (~30–60 min before window) | Scheduled job — see `docs/supabase/pickup_sms_cron.sql` |

Handover-code SMS is deferred (QR in-app is primary).

## Auth OTP vs transactional

- **Supabase Auth OTP** — configured separately in Supabase Auth → Phone (may use Twilio or another provider).
- **Transactional SMS** — this Edge Function only; respects `notification_prefs.sms`.

## Test checklist

1. Profile phone + SMS toggle on (`/profile/notifications` web + mobile).
2. Sandbox PayHere payment → webhook → SMS received (or `{ skipped: true }` in logs if Twilio unset).
3. Toggle SMS off → no send (`skipped: sms_disabled_or_no_phone`).
4. Pickup cron SQL documented; run manually in SQL editor for staging.

## Templates

| `template` | Copy |
|------------|------|
| `reservation_confirmed` | Rescue bag reserved + reservation code |
| `pickup_reminder` | Pickup window starting + ref |

## Not in v1

Push (FCM/APNs), email — future Phase 4b.
