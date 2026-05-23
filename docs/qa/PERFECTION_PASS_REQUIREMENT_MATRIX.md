# Perfection pass requirement matrix

| # | Requirement | Phase | Todo IDs | Acceptance |
|---|-------------|-------|----------|------------|
| 1 | Customer reach (real) | 1A | p1a-customer-reach, p1a-analytics-hook-mobile | `count(distinct customer_id)` in window |
| 2 | Top selling items | 1A, 3A | p1a-top-selling-bags, p3a-mobile-analytics-ui | Live group-by bag_id; no TOP_ITEMS_DEMO in prod |
| 3 | Finance pending vs paid out | 1B, 0 | p1b-pending-vs-paid-out, p0-finance-definitions | Labels match settlements columns |
| 4 | Admin web dashboard live | 1C | p1c-admin-dashboard-live-kpis | No 1248/42 hardcoded |
| 5 | Promo stats honest | 1D, 0 | p1d-promo-no-demo-fallback, p0-promo-redemptions | used_count from redemptions |
| 6 | Pickup QR | 2A | p2a-qr-* | Web QR + merchant code/scan QA |
| 7 | Payment history | 2B | p2b-payment-history | Real orders list, no skeleton |
| 8 | Maps edge cases | 2C | p2c-map-* | QA checklist in MAP_EDGE_QA.md |
| 9 | Reviews visibility | 2D | p2d-reviews-visibility | No fake 4.2 avg |
| 10 | Favourites / empty copy | 2E | p2e-favourites-distance | Real distance |
| 11 | Popular times hour chart | 1A | p1a-popular-times-hour | Hour buckets, label matches |
| 12 | Disputes production | 3B | p3b-disputes-* | Live complaints only |
| 13 | Staff invites | 3C | p3c-staff-invite-* | Auth email + user_id |
| 14 | Bank branches | 3D | p3d-bank-onboarding-tier2 | Tier-2 doc |
| 15 | Bag quality + sold-out | 0, 3E | p0-inventory-rpc, p3e-* | Inventory RPC + UI |
| 16 | Web admin merchants/complaints | 4 | p4-web-* | Live Supabase |
| 17 | Export report | 1C | p1c-admin-export-* | CSV from live metrics |
| 18 | Audit log coverage | 5A | p5a-audit-* | Triggers + spot-check |
| 19 | Complaint photos + runbook | 5B, 5C | p5b-*, p5c-* | Intake + docs |
| — | MCP + error protocol | Protocol | protocol-*, gate-phase-* | PERFECTION_PASS_MCP_GATES.md |
