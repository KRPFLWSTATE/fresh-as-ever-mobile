# Complaint handling runbook

## Intake

1. Customer uses **Report a problem** on order detail (mobile/web) after collection or dispute.
2. Photos upload to `complaint-images` storage; URLs stored on `complaints.photos[]`.

## Triage

| Status | Meaning | Next step |
|--------|---------|-----------|
| open | New | Assign investigator |
| investigating | In progress | Request more evidence |
| escalated | Needs lead | Platform admin review |
| resolved | Closed | Notify customer |
| dismissed | No action | Document reason |

## Actions

- **Resolve:** Update complaint `status`, `resolution`, and optional `admin_notes`. Do not set order to `collected` via merchant UI.
- **Refund (admin or merchant):** `POST /api/orders/refund` with JWT. Card orders call PayHere Refund API when `orders.payhere_payment_id` is set; cash orders skip PayHere. Updates complaint to `resolved` when `complaint_id` is supplied.
- **Dismiss:** Mark `dismissed` with documented reason in `resolution`.
- **Escalate:** Mark `escalated`; link audit log entry.

Merchant **Disputes** list + detail allow **Refund** (outlet-scoped) and **Escalate** with `merchant_notes`. Platform admin retains dismiss and override flows.
