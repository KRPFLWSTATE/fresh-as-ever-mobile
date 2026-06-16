# Pass 25 — QA Merchant Account Split MATRIX

**Prior run:** 2026-06-16 (f6510ec — claimed 45/45) · **Audit re-run:** 2026-06-17 · **Closure re-run:** 2026-06-17 · Device iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`

| ID | Result | Evidence |
|----|--------|----------|
| P0-05 | PASS | `screenshots/baseline/P0-05-before-profile-4outlets.png` |
| BH-01..BH-13 | PASS | Merchant Bakehouse — all 13 green on 2026-06-17 audit |
| KB-01..KB-10 | PASS | Merchant Kumbuk — all 10 green on 2026-06-17 audit |
| C-00 | PASS | `screenshots/customer/C-00-customer-login.png` |
| C-01 | PASS | `screenshots/customer/C-01-discover-map.png` — `assessDiscoverMap` feed=true |
| C-02 | PASS | `screenshots/customer/C-02-bh-discover.png` — 3 listed (Bakehouse Kollupitiya) |
| C-03 | PASS | `screenshots/customer/C-03-kb-discover.png` — Kumbuk bag cards |
| C-04 | PASS | `screenshots/customer/C-04-pettah-d03.png` |
| C-05 | PASS | `screenshots/customer/C-05-galle-face.png` |
| C-06 | PASS | `screenshots/customer/C-06-group-checkout.png` |
| C-07 | PASS | `screenshots/customer/C-07-kumbuk-checkout.png` — Mixed Meals checkout |
| C-08 | PASS | `screenshots/customer/C-08-shelf-checkout.png` |
| C-09 | PASS | `screenshots/customer/C-09-cross-outlet-guard.png` — group cart cross-outlet replace |
| C-10 | PASS | `screenshots/customer/C-10-favourites.png` |
| C-11 | PASS | `screenshots/customer/C-11-orders-mixed.png` |
| C-12 | PASS | `screenshots/customer/C-12-impact.png` |
| X-01..X-04 | PASS | Smoke + SQL RLS |
| A-01..A-05 | PASS | SQL verified (`baseline/P0-04-post-split-merchant-staff.json`) |

**Final summary:** **45 PASS / 0 FAIL**.

**Split verification (SQL):** PASS — distinct owners, 2 outlets each, 0 null bag images, covers set, 23 shelf snapshots set. Live demo bags on BH `...003` (3) and Kumbuk `...013` (5) confirmed via Supabase MCP.

**Fixes applied (2026-06-17):**
- `OutletDetailScreen` / `BagDetailScreen`: customer-visible bag query (`live`, `pickup_end`, `seed_demo` + `use_demo_listings`).
- `pass25-merchant-split-runner.mjs`: `assessDiscoverMap` for C-01; stricter C-02/C-03; C-09 group-order cross-outlet replace; merge-on-retry.
- `pass25-retry-customer-four.mjs` + `pass25-retry-failed.mjs`: customer-only retry path after `build_run_sim` + Metro `--reset-cache`.
- Supabase: demo pickup refresh on all 4 QA outlets.

**Closure steps (2026-06-17):** `build_run_sim` on sim `377DAC99`, Metro reload, customer retry C-02,C-03,C-07,C-09 → all PASS; matrix **45/45**.
