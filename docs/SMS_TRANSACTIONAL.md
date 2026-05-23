# Transactional SMS (follow-on)

Fresh As Ever mobile **persists SMS preferences** on `profiles.notification_prefs` and requires a **phone number** on the profile before enabling SMS alerts. **Supabase Auth OTP** (sign-in) uses the carrier/SMS path configured in your Supabase project.

## Not yet wired in this repo

Outbound transactional SMS (order confirmed, pickup reminder, handover code) needs:

1. A provider (Twilio, MessageBird, local LK gateway, etc.)
2. A Supabase Edge Function or backend worker that reads `notification_prefs` and sends only when opted in
3. Templates registered for Sri Lanka compliance where applicable

## Intended triggers

| Event | Audience |
|-------|----------|
| Reservation confirmed (paid) | Customer |
| Pickup window starting soon | Customer |
| Handover code ready | Customer (optional; QR in-app is primary) |
| Merchant staff invite accepted | Staff |

Until the provider is connected, in-app push/email toggles still save correctly; SMS toggle is gated on profile phone.
