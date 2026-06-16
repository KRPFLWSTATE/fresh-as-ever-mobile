# Pass 25 — QA Merchant Account Split MATRIX

**Prior run:** 2026-06-16 (f6510ec — claimed 45/45) · **Audit re-run:** 2026-06-17 · Device iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`

| ID | Result | Evidence |
|----|--------|----------|
| P0-05 | PASS | `screenshots/baseline/P0-05-before-profile-4outlets.png` |
| BH-01..BH-13 | PASS | Merchant Bakehouse — all 13 green on 2026-06-17 audit |
| KB-01..KB-10 | PASS | Merchant Kumbuk — all 10 green on 2026-06-17 audit |
| C-00 | PASS | `screenshots/customer/C-00-customer-login.png` |
| C-01 | PASS | `screenshots/customer/C-01-discover-map.png` — `assessDiscoverMap` feed=true |
| C-02 | **FAIL** | `screenshots/customer/C-02-bh-discover.png` — outlet **0 listed** (prior PASS was false positive on "Rescue" in empty-state copy) |
| C-03 | **FAIL** | `screenshots/customer/C-03-kb-discover.png` — Kumbuk **0 listed**; bag deeplink **Bag unavailable** |
| C-04 | PASS | `screenshots/customer/C-04-pettah-d03.png` |
| C-05 | PASS | `screenshots/customer/C-05-galle-face.png` |
| C-06 | PASS | `screenshots/customer/C-06-group-checkout.png` |
| C-07 | **FAIL** | `screenshots/customer/C-07-kumbuk-checkout.png` — Bag unavailable |
| C-08 | PASS | `screenshots/customer/C-08-shelf-checkout.png` |
| C-09 | **FAIL** | `screenshots/customer/C-09-cross-outlet-guard.png` — blocked by upstream bag load failures |
| C-10 | PASS | `screenshots/customer/C-10-favourites.png` |
| C-11 | PASS | `screenshots/customer/C-11-orders-mixed.png` |
| C-12 | PASS | `screenshots/customer/C-12-impact.png` |
| X-01..X-04 | PASS | Smoke + SQL RLS |
| A-01..A-05 | PASS | SQL verified (`baseline/P0-04-post-split-merchant-staff.json`) |

**Audit summary:** **41 PASS / 4 FAIL** (C-02, C-03, C-07, C-09).

**Split verification (SQL):** PASS — distinct owners, 2 outlets each, 0 null bag images, covers set, 23 shelf snapshots set.

**Fixes applied in audit (2026-06-17):**
- `OutletDetailScreen`: customer-visible bag query (`live`, `pickup_end`, `seed_demo` + `use_demo_listings`).
- `BagDetailScreen`: customer-visible bag fetch (`maybeSingle`, live/qty/pickup filters).
- `pass25-merchant-split-runner.mjs`: `assessDiscoverMap` for C-01; stricter C-02/C-03; merge-on-retry results.
- Supabase: `_ensure_outlet_demo_listings_core` + demo pickup refresh on all 4 QA outlets.
- `pass23-cross-portal/MATRIX.md`: 2-outlet-per-merchant wording post-split.

**Blocked / follow-up:** Rebuild sim app from Metro (or fresh `build_run_sim`) so customer bag visibility fixes ship; re-run C-02,C-03,C-07,C-09.
