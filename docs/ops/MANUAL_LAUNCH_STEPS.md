# Manual launch steps (Supabase + Vercel + Twilio)

Code and migrations are in GitHub; these steps wire secrets and paid Supabase features.

Project: **Fresh As Ever** — `odkbpeelvcdmlimdflbr` (ap-south-1)

---

## 1. Leaked password protection (requires Supabase upgrade)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/odkbpeelvcdmlimdflbr).
2. **Organization → Billing** — upgrade the org/plan so **Password security / leaked password protection** is available (Pro or equivalent).
3. **Authentication → Providers → Email** — enable **Prevent the use of leaked passwords** (HaveIBeenPwned).
4. Re-run **Database → Advisors → Security** — `auth_leaked_password_protection` should clear.

Until upgraded, this stays a documented warning only.

---

## 2. Twilio secrets (transactional SMS)

Edge function `send-transactional-sms` is deployed (v2). SMS will not send until secrets exist.

1. [Twilio Console](https://console.twilio.com/) — create or use an account with an **Sri Lanka–capable** sender number.
2. Supabase → **Project Settings → Edge Functions → Secrets** (or CLI below).
3. Add:

| Secret | Example |
|--------|---------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | your auth token |
| `TWILIO_FROM_NUMBER` | E.164, e.g. `+94771234567` |

**CLI (optional):**

```bash
cd /path/to/fresh-as-ever
supabase link --project-ref odkbpeelvcdmlimdflbr
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx TWILIO_AUTH_TOKEN=xxx TWILIO_FROM_NUMBER=+94xxxxxxxx
```

**Smoke test:** Profile with phone + SMS toggle on → sandbox PayHere payment → check Twilio logs. If Twilio is unset, webhook still succeeds; edge function returns `Twilio not configured`.

---

## 3. PayHere refund env (Vercel)

Refunds call PayHere’s API from the **web** app (`POST /api/orders/refund`).

1. [Vercel](https://vercel.com) → project **fresh-as-ever** → **Settings → Environment Variables**.
2. Add for **Preview** and **Production**:

| Variable | Mark as | Notes |
|----------|---------|--------|
| `PAYHERE_APP_ID` | Sensitive | PayHere merchant app OAuth |
| `PAYHERE_APP_SECRET` | Sensitive | Pair with app id |
| `PAYHERE_API_BASE` | Safe | Sandbox: `https://sandbox.payhere.lk` — live URL when you go live |
| `PAYHERE_SECRET` | Sensitive | Already used for webhook MD5 |
| `NEXT_PUBLIC_PAYHERE_MERCHANT_ID` | Safe | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Sensitive | Refund route uses service role |

3. **Redeploy** the latest `main` commit after saving vars.

**Sandbox test:** Pay with PayHere → confirm `orders.payhere_payment_id` is set (webhook) → admin or merchant **Refund** on a complaint → order `payment_status = refunded`.

---

## 4. Pickup reminder SMS (Vercel Cron — shipped)

Reservation SMS is triggered from the PayHere webhook. **Pickup reminders** run on Vercel:

1. Apply migration `pickup_reminder_sent_at_v1` (column `orders.pickup_reminder_sent_at`).
2. Vercel env (Preview + Production):

| Variable | Notes |
|----------|--------|
| `CRON_SECRET` | Random string; cron route checks `x-vercel-cron` + this secret |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` | Same as webhook/refund |

3. Redeploy so `vercel.json` cron runs `GET /api/cron/pickup-reminders` every **15 minutes** (orders with bag `pickup_start` in **30–60 minutes**).

**Manual test:**

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_VERCEL_HOST/api/cron/pickup-reminders"
```

**Alternative:** Enable `pg_net` on Supabase and use SQL in `docs/supabase/pickup_sms_cron.sql` (`pg_cron` is already enabled; `pg_net` is not on this project yet).

---

## 5. Mobile dev: if HMR error returns

If you see `Expected HMRClient.setup() call at startup`:

```bash
cd fresh-as-ever-mobile
watchman watch-del-all 2>/dev/null || true
rm -rf /tmp/metro-* node_modules/.cache
npm start -- --reset-cache
```

In a second terminal: `npm run ios` (full rebuild, not only reload).

Avoid `import('module')` in app code in dev; use static `import` or `require()` (see Expo issue #43627).

---

## 6. QA checklist

Use [STITCH_AUDIT_CLOSURE.md](../qa/STITCH_AUDIT_CLOSURE.md) after the steps above.
