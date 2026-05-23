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
- **Refund (admin):** Mobile admin complaint detail and web `/admin/complaints/[id]` expose **Issue refund** when `order_id` is set. This sets `orders.payment_status = refunded`, `order_status = cancelled`, then marks the complaint `resolved`. Requires admin RLS on `orders` update.
- **Dismiss:** Mark `dismissed` with documented reason in `resolution`.
- **Escalate:** Mark `escalated`; link audit log entry.

Merchant **Disputes** screen is read-only — resolution is admin/support only.
