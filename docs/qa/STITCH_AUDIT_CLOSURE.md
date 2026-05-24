# Stitch audit closure — manual QA

Use this checklist after deploying migrations, Edge Function, and Vercel env vars.

**Last code review:** 2026-05-24 (post May 2026 audit backlog ship)

## Ops

- [ ] Supabase Auth → enable leaked password protection **after plan upgrade** ([SUPABASE_AUTH_CHECKLIST.md](../ops/SUPABASE_AUTH_CHECKLIST.md))
- [x] Apply migrations: `payhere_payment_id`, merchant complaint RLS, RPCs, `pickup_reminder_sent_at` (Supabase MCP 2026-05-24)
- [x] Deploy `send-transactional-sms` — reads `SUPABASE_SECRET_KEYS` with legacy fallback; **Twilio secrets** must be set in Supabase Dashboard for live SMS

## Refunds (PayHere + API)

- [ ] Sandbox card payment stores `orders.payhere_payment_id` via webhook (code wired in `payhere/webhook/route.js` — verify in sandbox)
- [ ] Admin complaint → Issue refund → PayHere + DB `payment_status = refunded` (`postOrderRefund` / `refundOrder.js`)
- [ ] Merchant dispute detail → Refund customer → same API (web + mobile `postOrderRefund`)
- [ ] Cash order refund skips PayHere, updates DB only (`refundOrder.js`)
- [ ] Idempotent second refund returns success

## Web profile parity

- [x] `/profile/notifications` loads/saves `profiles.notification_prefs`; SMS gated on phone (`useNotificationPrefs.js`)
- [x] `/profile/support` FAQs, search, mailto / WhatsApp / tel (`profile/support/page.js`)
- [x] `/merchant/disputes` lists `complaints` scoped to outlets (`useMerchantComplaints.js`)
- [x] `/merchant/disputes/[id]` refund + escalate (refund via `postOrderRefundClient`)

## Mobile polish

- [x] Profile payments **View All** → Orders tab (`ProfilePaymentsScreen` → `MainTabs` / `OrdersTab`)
- [x] Connection error: exponential backoff retries (1s → 2s → 4s), max 3 (`ConnectionErrorScreen.tsx`)
- [ ] Admin complaint evidence: full-screen modal lightbox (verify on device)
- [ ] Admin complaints list: priority chips (open / escalated / unresolved) (verify on device)

## SMS

- [ ] SMS opt-in + phone on profile (manual: toggle + save on web and mobile)
- [ ] Paid webhook sends reservation SMS when Twilio configured (manual sandbox payment)
- [ ] Pickup reminder cron: `CRON_SECRET` on Vercel + migration `pickup_reminder_sent_at`; test `GET /api/cron/pickup-reminders`

## Data

- [ ] Merchant dashboard popular bags show thumbnails + order counts (verify with live data)
- [ ] Admin merchants list rescue counts via `merchant_rescue_counts` RPC (verify with live data)

## CI

- [ ] Mobile: `npm run ci`
- [ ] Web: `npm test && npm run lint && npm run build`

## App icon (native)

- [x] iOS `Images.xcassets/AppIcon.appiconset/` populated from `fresh-as-ever/public/logo.png` (mark crop ≤120px; full logo @1024)
- [x] Android `mipmap-*/ic_launcher.png` + round variants
- [ ] Rebuild native binaries: `cd fresh-as-ever-mobile/ios && pod install` then Xcode archive, or `npx expo run:ios` / `run:android`
