# Handover QR acceptance matrix

| Step | Mobile customer | Web customer | Merchant |
|------|-----------------|--------------|----------|
| Display | QR + 6-char code on Order Detail | QR + 6-char via `OrderPickupQr` | — |
| Type code | — | — | Handover tab accepts 6 chars |
| Scan mobile QR | — | — | Parses reservation payload |
| Scan web QR | — | — | Same parser as mobile |

**SOP:** Code is primary; QR is convenience. Re-test after any change to `handoverQr` or order detail.
