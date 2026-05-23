# Stitch audit closure — manual QA

Use this checklist after deploying migrations, Edge Function, and Vercel env vars.

## Ops

- [ ] Supabase Auth → enable leaked password protection ([SUPABASE_AUTH_CHECKLIST.md](../ops/SUPABASE_AUTH_CHECKLIST.md))
- [ ] Apply migrations: `payhere_payment_id`, merchant complaint RLS, RPCs
- [ ] Deploy `send-transactional-sms` + Twilio secrets

## Refunds (PayHere + API)

- [ ] Sandbox card payment stores `orders.payhere_payment_id` via webhook
- [ ] Admin complaint → Issue refund → PayHere + DB `payment_status = refunded`
- [ ] Merchant dispute detail → Refund customer → same API
- [ ] Cash order refund skips PayHere, updates DB only
- [ ] Idempotent second refund returns success

## Web profile parity

- [ ] `/profile/notifications` loads/saves `profiles.notification_prefs`; SMS gated on phone
- [ ] `/profile/support` FAQs, search, mailto / WhatsApp / tel; no dead Send Message
- [ ] `/merchant/disputes` lists `complaints` scoped to outlets
- [ ] `/merchant/disputes/[id]` refund + escalate

## Mobile polish

- [ ] Profile payments **View All** → Orders tab
- [ ] Connection error: backoff retries (1s → 2s → 4s), max 3
- [ ] Admin complaint evidence: full-screen modal lightbox
- [ ] Admin complaints list: priority chips (open / escalated / unresolved)

## SMS

- [ ] SMS opt-in + phone on profile
- [ ] Paid webhook sends reservation SMS when Twilio configured

## Data

- [ ] Merchant dashboard popular bags show thumbnails + order counts
- [ ] Admin merchants list rescue counts via `merchant_rescue_counts` RPC

## CI

- [ ] Mobile: `npm run ci`
- [ ] Web: `npm test && npm run lint && npm run build`
