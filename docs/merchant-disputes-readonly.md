# Merchant disputes (read-only)

`MerchantDisputesScreen` lists live `complaints` joined to orders. Merchants can **view** status and description only.

Resolution, refunds, and status changes are performed by **platform admin** (mobile admin stack or web `/admin/complaints`).

`__DEV__` sample layouts must not ship in release builds — production uses live queries only.
