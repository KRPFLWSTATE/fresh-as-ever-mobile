# Pass 26 — Triple Portal Triangulation (TPT)

Every cross-feature ID (`F*-X*`, `X-*`) and integration gate requires **5/5 portal agreement** on the same canonical UUID before MATRIX status → PASS.

## Protocol (per ID)

1. **Pick canonical UUID** — Supabase `execute_sql` selects listing or order id (record in verify-log).
2. **Customer mobile** — Appium screenshot + testID assertion (`screenshots/cross/` or feature folder).
3. **Merchant mobile** — Correct account (Bakehouse `qa.merchant@` vs Kumbuk `qa.kumbuk@`); screenshot.
4. **Web customer** — Chrome DevTools snapshot (`fresh-as-ever` discover/bag/shelf/order).
5. **Web merchant/admin** — Where applicable (F4 admin windows, F5 merchant orders).
6. **SQL row dump** — All UI-visible fields must match DB source of truth.

**PASS rule:** 5/5 agree within SLA (F3/F5: 30s / 10s realtime where noted). Else → spawn `SA-FIX-{ID}`.

## Comparison checklist template

Copy one block per triangulation row in verify-log / REPORT:

```markdown
### {MATRIX_ID} — {short title}
- **Canonical UUID:** `{uuid}` (table: `{table}`)
- **Captured at:** {ISO timestamp}

| Field | SQL | Customer mobile | Merchant mobile | Web customer | Web merchant/admin | Match |
|-------|-----|-----------------|-----------------|--------------|-------------------|-------|
| {field1} | | | | | | ☐ |
| {field2} | | | | | | ☐ |

**Evidence:** `screenshots/...`, CDP snapshot path, SQL JSON path
**Result:** PENDING | PASS | FAIL
**Fix worker:** SA-FIX-{ID} (retry n/3)
```

## Account routing

| Portal | Account | When |
|--------|---------|------|
| Customer mobile/web | `qa.customer@freshasever.test` | Discover, order detail, share |
| Merchant Bakehouse | `qa.merchant@freshasever.test` | Outlets `...003`, Galle Face |
| Merchant Kumbuk | `qa.kumbuk@freshasever.test` | Outlets `...013`, Pettah |
| Admin web | `qa.admin@freshasever.test` | F4 windows, merchant list |

## Feature-specific triangulation notes

| Feature | Must match across portals |
|---------|---------------------------|
| F1 | `pickup_window_kind`, browse pill state vs `pickup_start`/`pickup_end` |
| F2 | WhatsApp message body: LKR, window text, deeplink |
| F3 | `outlets.landmark` ↔ card subtitle segment |
| F4 | `occasion_kind` ↔ badge label; admin window dates ↔ picker visibility |
| F5 | `customer_on_the_way_at` / `customer_arrived_at` ↔ merchant live monitor tier |
| F6/F7 | Push LKR ↔ `useCustomerImpact` month slice; ledger idempotency |

## Cross-feature IDs (X-01..X-35)

Document combo behavior in this file as workers complete Wave 4. X-01..X-09 have explicit scenarios in plan; X-10..X-35 are pairwise/multi-feature combos — same 5-portal rule applies.
