# Merchant disputes

`MerchantDisputesScreen` lists live `complaints` joined to orders for the merchant's outlets.

## Merchant actions (detail screen)

- **View** complaint, evidence, order ref, customer note
- **Refund customer** — `POST /api/orders/refund` (PayHere for card when `payhere_payment_id` exists)
- **Escalate to Fresh As Ever** — sets `status = escalated` and optional `merchant_notes`

Merchants cannot dismiss complaints or refund orders outside their outlet scope.

## Platform admin

Resolution, dismiss, and override flows remain on mobile admin stack and web `/admin/complaints`.

`__DEV__` sample layouts must not ship in release builds — production uses live queries only.
