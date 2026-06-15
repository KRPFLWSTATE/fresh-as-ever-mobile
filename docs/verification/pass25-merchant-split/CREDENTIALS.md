# Pass 25 — QA Merchant Account Split Credentials

| Account | Password | Business | Merchant ID | Outlets |
|---------|----------|----------|-------------|---------|
| `qa.merchant@freshasever.test` | `TempMerchant#12345` | Bakehouse Colombo | `00000000-0000-0000-0000-000000000002` | Bakehouse Kollupitiya (`00000000-0000-0000-0000-000000000003`) + `[Demo] Galle Face Bites` (`b4884c9f-5a7c-41b0-af19-321c66f24dea`) |
| `qa.kumbuk@freshasever.test` | `TempMerchant#12345` | Kumbuk QA Cafe | `00000000-0000-0000-0000-000000000012` | Kumbuk Colombo 07 (`00000000-0000-0000-0000-000000000013`) + `[Demo] Pettah Green Grocer` (`8fbdd459-d8b1-4c84-a6c4-fd00ccf57ac4`) |

## Login testIDs

- `login.email`, `login.password`, `login.signIn`, `login.portal.merchant`
- Deeplink: `freshasever://login?portal=merchant`

## Baseline notes (pre-split)

- Both merchants shared `qa.merchant@` owner (`c749c703-1306-437f-afb8-2bf5841f0b66`)
- Outlet→merchant mapping was already correct; split is owner_id + merchant_staff only
- Galle Face UUID: `b4884c9f-5a7c-41b0-af19-321c66f24dea` (not in seed migrations)
