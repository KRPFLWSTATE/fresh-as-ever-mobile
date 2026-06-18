# Pass 26 — Sri Lanka Expansion MATRIX

**Branch:** `feature/pass26-expansion` · **Target:** 180 IDs all PASS before release · **Device:** iPhone 17 Pro `377DAC99-B79C-4B05-BB34-DBA1D160038D`

| ID | Feature | Portal | Account | Steps | Status | Evidence |
|----|---------|--------|---------|-------|--------|----------|
| F1-SQL01 | F1 Pickup Windows | DB | — | All demo listings have non-null pickup_window_kind (post-migration) | PASS | baseline/f1-sql-post.json |
| F1-P0 | F1 Pickup Windows | Setup | — | Flags ON; sim Colombo geo; baseline screenshot | PASS | EXPO_PUBLIC_PICKUP_WINDOW_PRESETS=true; sim 377DAC99 |
| F1-M01 | F1 Pickup Windows | Merchant | qa.merchant@ | Merchant preset chip flow M01 | FAIL | screenshots/f1/F1-M01-login-fail.png
| F1-M02 | F1 Pickup Windows | Merchant | qa.merchant@ | Merchant preset chip flow M02 | FAIL | screenshots/f1/F1-M02-login-fail.png
| F1-M03 | F1 Pickup Windows | Merchant | qa.merchant@ | Merchant preset chip flow M03 | FAIL | screenshots/f1/F1-M03-login-fail.png
| F1-M04 | F1 Pickup Windows | Merchant | qa.kumbuk@ | Merchant preset chip flow M04 | FAIL | screenshots/f1/F1-M04-login-fail.png
| F1-M05 | F1 Pickup Windows | Merchant | qa.merchant@ | Merchant preset chip flow M05 | FAIL | screenshots/f1/F1-M05-login-fail.png
| F1-M06 | F1 Pickup Windows | Merchant | qa.kumbuk@ | Merchant preset chip flow M06 | FAIL | screenshots/f1/F1-M06-login-fail.png
| F1-C01 | F1 Pickup Windows | Customer | qa.customer@ | Customer discover/search pill C01 | FAIL | screenshots/f1/F1-C01.png
| F1-C02 | F1 Pickup Windows | Customer | qa.customer@ | Customer discover/search pill C02 | FAIL | screenshots/f1/F1-C02.png
| F1-C03 | F1 Pickup Windows | Customer | qa.customer@ | Customer discover/search pill C03 | FAIL | screenshots/f1/F1-C03.png
| F1-C04 | F1 Pickup Windows | Customer | qa.customer@ | Customer discover/search pill C04 | FAIL | screenshots/f1/F1-C04.png
| F1-C05 | F1 Pickup Windows | Customer | qa.customer@ | Customer discover/search pill C05 | FAIL | screenshots/f1/F1-C05.png
| F1-W01 | F1 Pickup Windows | Web | — | Web bag detail pickup label matches mobile | PENDING |  |
| F1-X01 | F1 Pickup Windows | Cross | C+M | Same bag UUID: merchant kind = customer pill | FAIL | screenshots/f1/F1-X01-login-fail.png
| F1-X02 | F1 Pickup Windows | Cross | BH+KB | Both merchants bags on discover with correct kinds | FAIL | screenshots/f1/F1-X02-login-fail.png
| F1-R01 | F1 Pickup Windows | Regression | qa.customer@ | Reserve Now checkout still completes (Pass 24) | FAIL | screenshots/f1/F1-R01-login-fail.png
| F1-R02 | F1 Pickup Windows | Regression | — | Pass25 C-06 group overlap still enforced | FAIL | screenshots/f1/F1-R02-login-fail.png
| F2-P0 | F2 WhatsApp Share | Setup | — | LISTING_WHATSAPP_SHARE flag ON; sim ready | PASS | local env
| F2-SQL01 | F2 WhatsApp Share | DB | — | N/A client-only baseline | PASS | listingShare.test.ts + wa.me 302 |
| F2-C01 | F2 WhatsApp Share | Customer | qa.customer@ | Bag/shelf WhatsApp share C01 | FAIL | screenshots/f2/F2-C01.png |
| F2-C02 | F2 WhatsApp Share | Customer | qa.customer@ | Bag/shelf WhatsApp share C02 | FAIL | screenshots/f2/F2-C02.png |
| F2-C03 | F2 WhatsApp Share | Customer | qa.customer@ | Bag/shelf WhatsApp share C03 | FAIL | screenshots/f2/F2-C03.png |
| F2-C04 | F2 WhatsApp Share | Customer | qa.customer@ | Bag/shelf WhatsApp share C04 | FAIL | screenshots/f2/F2-C04.png |
| F2-C05 | F2 WhatsApp Share | Customer | qa.customer@ | Bag/shelf WhatsApp share C05 | FAIL | screenshots/f2/F2-C05.png |
| F2-W01 | F2 WhatsApp Share | Web | — | Web bag ShareNetwork → wa.me | PASS | screenshots/web/F2-W01-bag-whatsapp-share.png |
| F2-W02 | F2 WhatsApp Share | Web | — | Web shelf share button | PASS | screenshots/web/F2-W02-shelf-whatsapp-share.png |
| F2-W03 | F2 WhatsApp Share | Web | — | Deeplink page `/bags/{id}` loads | PASS | screenshots/web/F2-W03-bag-deeplink-alias.png |
| F2-M01 | F2 WhatsApp Share | Merchant | qa.merchant@ | Share message outlet name Bakehouse | FAIL | screenshots/f2/F2-M01-login-fail.png
| F2-M02 | F2 WhatsApp Share | Merchant | qa.kumbuk@ | Pettah shelf share cross-check | FAIL | screenshots/f2/F2-M02-login-fail.png
| F2-X01 | F2 WhatsApp Share | Cross | C+M+W | Share triangulation X01 | FAIL | screenshots/f2/F2-X01.png
| F2-X02 | F2 WhatsApp Share | Cross | C+M+W | Share triangulation X02 | FAIL | screenshots/f2/F2-X02.png
| F2-X03 | F2 WhatsApp Share | Cross | C+M+W | Share triangulation X03 | FAIL | screenshots/f2/F2-X03.png
| F2-R01 | F2 WhatsApp Share | Regression | qa.customer@ | Reserve Now after share tap back | FAIL | screenshots/f2/F2-R01.png
| F2-R02 | F2 WhatsApp Share | Regression | qa.customer@ | Pass25 shelf checkout C-09 | FAIL | screenshots/f2/F2-R02.png
| F3-SQL01 | F3 Neighbourhood | DB | — | 4/4 demo outlets landmark NOT NULL | PASS | baseline/f3-sql-post.json |
| F3-SQL02 | F3 Neighbourhood | DB | — | Bakehouse=Kollupitiya, Kumbuk=Colombo 07, Pettah=Pettah | PASS | baseline/f3-sql-post.json |
| F3-P0 | F3 Neighbourhood | Setup | — | NEIGHBOURHOOD_BROWSE flag ON; feed loaded | PASS | EXPO_PUBLIC_NEIGHBOURHOOD_BROWSE=true local |
| F3-M01 | F3 Neighbourhood | Merchant | qa.merchant@ | Landmark edit/save M01 | FAIL | screenshots/f3/F3-M01-login-fail.pngoutlet.landmark field + testID
| F3-M02 | F3 Neighbourhood | Merchant | qa.kumbuk@ | Landmark edit/save M02 | FAIL | screenshots/f3/F3-M02-login-fail.pngMerchantOutletEditorScreen landmark
| F3-M03 | F3 Neighbourhood | Merchant | qa.merchant@ | Landmark edit/save M03 | FAIL | screenshots/f3/F3-M03-login-fail.pngweb parity in outlets/[id]/page.js
| F3-C01 | F3 Neighbourhood | Customer | qa.customer@ | Card subtitle + filter C01 | FAIL | screenshots/f3/F3-C01.png
| F3-C02 | F3 Neighbourhood | Customer | qa.customer@ | Card subtitle + filter C02 | FAIL | screenshots/f3/F3-C02.png
| F3-C03 | F3 Neighbourhood | Customer | qa.customer@ | Card subtitle + filter C03 | FAIL | screenshots/f3/F3-C03.png
| F3-C04 | F3 Neighbourhood | Customer | qa.customer@ | Card subtitle + filter C04 | FAIL | screenshots/f3/F3-C04.png
| F3-C05 | F3 Neighbourhood | Customer | qa.customer@ | Card subtitle + filter C05 | FAIL | screenshots/f3/F3-C05.png
| F3-W01 | F3 Neighbourhood | Web | — | Discover card subtitle parity | PENDING |  |
| F3-W02 | F3 Neighbourhood | Web | — | Search neighbourhood chips | PENDING |  |
| F3-X01 | F3 Neighbourhood | Cross | C+M+SQL | Landmark triangulation X01 | FAIL | screenshots/f3/F3-X01.png
| F3-X02 | F3 Neighbourhood | Cross | C+M+SQL | Landmark triangulation X02 | FAIL | screenshots/f3/F3-X02.png
| F3-X03 | F3 Neighbourhood | Cross | C+M+SQL | Landmark triangulation X03 | FAIL | screenshots/f3/F3-X03.png
| F3-X04 | F3 Neighbourhood | Cross | C+M+SQL | Landmark triangulation X04 | FAIL | screenshots/f3/F3-X04.png
| F3-A01 | F3 Neighbourhood | Admin | qa.admin@ | Admin merchant list addresses | PENDING |  |
| F3-R01 | F3 Neighbourhood | Regression | qa.customer@ | Discover load Pass25 C-01 | FAIL | screenshots/f3/F3-R01.png
| F3-R02 | F3 Neighbourhood | Regression | qa.customer@ | Geo scope still Colombo | FAIL | screenshots/f3/F3-R02.png
| F4-SQL01 | F4 Seasonal Badges | DB | — | seasonal_occasion_windows seeded | PASS | f4-sql-post.json |
| F4-SQL02 | F4 Seasonal Badges | DB | — | Demo bag tagged avurudu during window | PASS | avurudu window extended Jun 2026 QA |
| F4-P0 | F4 Seasonal Badges | Setup | — | SEASONAL_BADGES flag ON | PASS | mobile .env + web .env.local |
| F4-M01 | F4 Seasonal Badges | Merchant | qa.merchant@ | Occasion picker M01 | FAIL | screenshots/f4/F4-M01-login-fail.png
| F4-M02 | F4 Seasonal Badges | Merchant | qa.merchant@ | Occasion picker M02 | FAIL | screenshots/f4/F4-M02-login-fail.png
| F4-M03 | F4 Seasonal Badges | Merchant | qa.kumbuk@ | Occasion picker M03 | FAIL | screenshots/f4/F4-M03-login-fail.png
| F4-C01 | F4 Seasonal Badges | Customer | qa.customer@ | Badge/filter C01 | FAIL | screenshots/f4/F4-C01.png
| F4-C02 | F4 Seasonal Badges | Customer | qa.customer@ | Badge/filter C02 | FAIL | screenshots/f4/F4-C02.pngdiscover.occasionChip.avurudu (Appium page source)
| F4-C03 | F4 Seasonal Badges | Customer | qa.customer@ | Badge/filter C03 | FAIL | screenshots/f4/F4-C03.png
| F4-W01 | F4 Seasonal Badges | Web | — | Discover badge parity | PENDING |  |
| F4-W02 | F4 Seasonal Badges | Web | — | Search occasion filter chip | PENDING |  |
| F4-A01 | F4 Seasonal Badges | Admin | qa.admin@ | Edit season window dates | PASS | Chrome DevTools /admin/seasonal-windows CRUD form |
| F4-A02 | F4 Seasonal Badges | Admin | qa.admin@ | Date change gates merchant picker | PENDING |  |
| F4-X01 | F4 Seasonal Badges | Cross | C+M+A | Seasonal triangulation X01 | FAIL | screenshots/f4/F4-X01.png
| F4-X02 | F4 Seasonal Badges | Cross | C+M+A | Seasonal triangulation X02 | FAIL | screenshots/f4/F4-X02.png
| F4-X03 | F4 Seasonal Badges | Cross | C+M+A | Seasonal triangulation X03 | FAIL | screenshots/f4/F4-X03.png
| F4-R01 | F4 Seasonal Badges | Regression | qa.customer@ | Untagged bags show without badge | FAIL | screenshots/f4/F4-R01.png
| F4-R02 | F4 Seasonal Badges | Regression | qa.merchant@ | Pass25 merchant publish flow | FAIL | screenshots/f4/F4-R02.png
| F5-SQL01 | F5 On My Way | DB | — | RPC customer_signal_on_the_way exists | PASS | baseline/f5-sql-post.json |
| F5-C01 | F5 On My Way | Customer | qa.customer@ | On my way / arrived CTA C01 | FAIL | screenshots/f5/F5-C01.pngscreenshots/f5/F5-C01-login-fail.png — sim login after marathon
| F5-C02 | F5 On My Way | Customer | qa.customer@ | On my way / arrived CTA C02 | FAIL | screenshots/f5/F5-C02.pngscreenshots/f5/F5-C02-login-fail.png
| F5-C03 | F5 On My Way | Customer | qa.customer@ | On my way / arrived CTA C03 | FAIL | screenshots/f5/F5-C03.pngscreenshots/f5/F5-C03-login-fail.png
| F5-C04 | F5 On My Way | Customer | qa.customer@ | On my way / arrived CTA C04 | FAIL | screenshots/f5/F5-C04.pngscreenshots/f5/F5-C04-login-fail.png
| F5-C05 | F5 On My Way | Customer | qa.customer@ | On my way / arrived CTA C05 | FAIL | screenshots/f5/F5-C05.pngscreenshots/f5/F5-C05-login-fail.png
| F5-M01 | F5 On My Way | Merchant | qa.merchant@ | Live monitor / orders badge M01 | FAIL | screenshots/f5/F5-M01-login-fail.pngscreenshots/f5/F5-M01-login-fail.png
| F5-M02 | F5 On My Way | Merchant | qa.merchant@ | Live monitor / orders badge M02 | FAIL | screenshots/f5/F5-M02-login-fail.pngscreenshots/f5/F5-M02-login-fail.png
| F5-M03 | F5 On My Way | Merchant | qa.merchant@ | Live monitor / orders badge M03 | FAIL | screenshots/f5/F5-M03-login-fail.pngscreenshots/f5/F5-M03-login-fail.png
| F5-M04 | F5 On My Way | Merchant | qa.kumbuk@ | Live monitor / orders badge M04 | FAIL | screenshots/f5/F5-M04-login-fail.pngscreenshots/f5/F5-M04-login-fail.png
| F5-M05 | F5 On My Way | Merchant | qa.merchant@ | Live monitor / orders badge M05 | FAIL | screenshots/f5/F5-M05-login-fail.pngscreenshots/f5/F5-M05-login-fail.png
| F5-W01 | F5 On My Way | Web | — | Web merchant orders chips | PENDING | CDP — en-route + at-outlet chips |
| F5-X01 | F5 On My Way | Cross | C+M+SQL | Realtime signal triangulation X01 | FAIL | screenshots/f5/F5-X01.pngpass26-f5-appium — login blocked
| F5-X02 | F5 On My Way | Cross | C+M+SQL | Realtime signal triangulation X02 | FAIL | screenshots/f5/F5-X02.png
| F5-X03 | F5 On My Way | Cross | C+M+SQL | Realtime signal triangulation X03 | FAIL | screenshots/f5/F5-X03.png
| F5-X04 | F5 On My Way | Cross | C+M+SQL | Realtime signal triangulation X04 | FAIL | screenshots/f5/F5-X04.png
| F5-A01 | F5 On My Way | Admin | qa.admin@ | Admin order view signals if exposed | PENDING |  |
| F5-R01 | F5 On My Way | Regression | qa.customer@ | Pass24 reserve hang | FAIL | screenshots/f5/F5-R01.png
| F5-R02 | F5 On My Way | Regression | qa.customer@ | Pass25 cross-portal C-10/C-11 | FAIL | screenshots/f5/F5-R02.png
| F7-SQL01 | F6/F7 Monthly Savings | DB | — | Ledger/savings SQL SQL01 | PASS | baseline/f7-sql-post.json |
| F7-SQL02 | F6/F7 Monthly Savings | DB | — | Ledger/savings SQL SQL02 | PASS | qa.customer 2026-06 savedRs=2450 |
| F7-SQL03 | F6/F7 Monthly Savings | DB | — | Ledger/savings SQL SQL03 | PASS | 2026-05 skip not_eligible |
| F7-EDGE01 | F6/F7 Monthly Savings | Server | — | Invoke edge fn test period | PASS | dryRun 200 |
| F7-CRON01 | F6/F7 Monthly Savings | Server | — | Vercel cron route auth + 200 | PASS | local curl HTTP 200 skipped feature_disabled |
| F7-C01 | F6/F7 Monthly Savings | Customer | qa.customer@ | Notification UX C01 | PASS | screenshots/f7/F7-C01.png |
| F7-C02 | F6/F7 Monthly Savings | Customer | qa.customer@ | Notification UX C02 | PASS | screenshots/f6/F7-C02.png impact deeplink |
| F7-C03 | F6/F7 Monthly Savings | Customer | qa.customer@ | Notification UX C03 | PASS | Monthly impact toggle visible |
| F7-W01 | F6/F7 Monthly Savings | Web | — | Notification prefs web parity | PASS | code parity mobile+web monthly_impact row; CDP N/A |
| F7-X01 | F6/F7 Monthly Savings | Cross | C+SQL | Push LKR = useCustomerImpact month slice | PASS | Edge dryRun savedRs=2450 June 2026 |
| F7-X02 | F6/F7 Monthly Savings | Cross | SQL | ≥2 orders threshold enforced | PASS | edge dryRun eligibility |
| F7-A01 | F6/F7 Monthly Savings | Admin | — | Cron logs no errors | PASS | local cron 200 ok no error |
| F7-R01 | F6/F7 Monthly Savings | Regression | DB | Other push types still work | PASS | shelf_publish queue 10 rows; notifications monthly_savings×2 |
| F7-R02 | F6/F7 Monthly Savings | Regression | qa.customer@ | Pass25 customer profile | PENDING | merchantLogout+loginCustomer timeout; F7-C01 customer session PASS |
| X-01 | Cross-feature | Cross | multi | Morning bag + WhatsApp deeplink + neighbourhood card | PENDING |  |
| X-02 | Cross-feature | Cross | multi | Seasonal badge in filtered neighbourhood | PENDING |  |
| X-03 | Cross-feature | Cross | multi | On my way → merchant collect → impact includes savings | PENDING |  |
| X-04 | Cross-feature | Cross | multi | Group checkout pickup overlap (F1 + C6) | PENDING |  |
| X-05 | Cross-feature | Cross | multi | Kumbuk shelf + WhatsApp + Pettah landmark | PENDING |  |
| X-06 | Cross-feature | Cross | multi | Switch qa.merchant@ → qa.kumbuk@ mid-marathon — no stale outlet | PENDING |  |
| X-07 | Cross-feature | Cross | — | Admin seasonal + merchant list + order audit | PENDING |  |
| X-08 | Cross-feature | Cross | — | All 6 flags ON — discover loads < 5s | PENDING |  |
| X-09 | Cross-feature | Cross | multi | All 6 flags OFF — legacy UX unchanged | PENDING |  |
| X-10 | Cross-feature | Cross | multi | Pairwise combo F1+F2 | PENDING |  |
| X-11 | Cross-feature | Cross | — | Pairwise combo F1+F3 | PENDING |  |
| X-12 | Cross-feature | Cross | multi | Pairwise combo F1+F4 | PENDING |  |
| X-13 | Cross-feature | Cross | multi | Pairwise combo F1+F5 | PENDING |  |
| X-14 | Cross-feature | Cross | — | Pairwise combo F1+F7 | PENDING |  |
| X-15 | Cross-feature | Cross | multi | Pairwise combo F2+F3 | PENDING |  |
| X-16 | Cross-feature | Cross | — | Pairwise combo F2+F4 | PENDING |  |
| X-17 | Cross-feature | Cross | multi | Pairwise combo F2+F5 | PENDING |  |
| X-18 | Cross-feature | Cross | — | Pairwise combo F2+F7 | PENDING |  |
| X-19 | Cross-feature | Cross | — | Pairwise combo F3+F4 | PENDING |  |
| X-20 | Cross-feature | Cross | multi | Pairwise combo F3+F5 | PENDING |  |
| X-21 | Cross-feature | Cross | — | Pairwise combo F3+F7 | PENDING |  |
| X-22 | Cross-feature | Cross | multi | Pairwise combo F4+F5 | PENDING |  |
| X-23 | Cross-feature | Cross | — | Pairwise combo F4+F7 | PENDING |  |
| X-24 | Cross-feature | Cross | multi | Pairwise combo F5+F7 | PENDING |  |
| X-25 | Cross-feature | Cross | multi | Pairwise combo F1+F2+F3 | PENDING |  |
| X-26 | Cross-feature | Cross | — | Pairwise combo F2+F3+F4 | PENDING |  |
| X-27 | Cross-feature | Cross | multi | Pairwise combo F3+F4+F5 | PENDING |  |
| X-28 | Cross-feature | Cross | multi | Pairwise combo F4+F5+F7 | PENDING |  |
| X-29 | Cross-feature | Cross | multi | Pairwise combo F1+F5+F7 | PENDING |  |
| X-30 | Cross-feature | Cross | multi | Pairwise combo F2+F4+F5 | PENDING |  |
| X-31 | Cross-feature | Cross | multi | Pairwise combo F1+F3+F5 | PENDING |  |
| X-32 | Cross-feature | Cross | multi | Pairwise combo F2+F3+F5 | PENDING |  |
| X-33 | Cross-feature | Cross | — | Pairwise combo F3+F4+F7 | PENDING |  |
| X-34 | Cross-feature | Cross | multi | Pairwise combo F1+F4+F5 | PENDING |  |
| X-35 | Cross-feature | Cross | multi | Pairwise combo F2+F5+F7 | PENDING |  |
| P0-01 | Phase 0 Baseline | DB | — | Supabase pre-pass26.json captured | PENDING |  |
| P0-02 | Phase 0 Baseline | Xcode | — | session_show_defaults recorded | PENDING |  |
| P0-03 | Phase 0 Baseline | Appium | — | Sim UDID 377DAC99 ready; geolocation Colombo | PENDING |  |
| P0-04 | Phase 0 Baseline | Config | — | All pass26 flags default OFF mobile+web | PENDING |  |
| P0-05 | Phase 0 Baseline | Regression | — | Pass25 runner available; 45/45 reference | PENDING |  |
| INT-TYPECHECK-M | Integration | Shell | — | npm run typecheck mobile | PENDING |  |
| INT-TYPECHECK-W | Integration | Shell | — | npm run typecheck web | PENDING |  |
| INT-JEST-M | Integration | Shell | — | npm run typecheck mobile | PENDING |  |
| INT-JEST-W | Integration | Shell | — | npm run typecheck web | PENDING |  |
| INT-ADVISORS-SEC | Integration | Supabase | — | get_advisors security/performance | PENDING |  |
| INT-ADVISORS-PERF | Integration | Supabase | — | get_advisors security/performance | PENDING |  |
| INT-WEB-CONSOLE | Integration | Chrome DevTools | — | Web smoke zero console errors | PENDING |  |
| INT-FLAGS-ALL-ON | Integration | Config | — | All 6 pass26 flags enabled integration branch | PENDING |  |
| INT-FLAGS-ALL-OFF | Integration | Config | — | All flags off — legacy UX | PENDING |  |
| INT-XCODE-BUILD | Integration | Xcode | — | build_run_sim fresh bundle smoke | PENDING |  |
| P24-01 | Pass 24 Regression | Customer | qa.customer@ | Reserve hang ID 1 | PENDING |  |
| P24-02 | Pass 24 Regression | Customer | qa.customer@ | Reserve hang ID 2 | PENDING |  |
| P24-03 | Pass 24 Regression | Customer | qa.customer@ | Reserve hang ID 3 | PENDING |  |
| P24-04 | Pass 24 Regression | Customer | qa.customer@ | Reserve hang ID 4 | PENDING |  |
| P25-REG-01 | Pass 25 Regression | Mixed | pass25 | Pass25 C-01 still PASS | PENDING |  |
| P25-REG-02 | Pass 25 Regression | Mixed | pass25 | Pass25 C-06 still PASS | PENDING |  |
| P25-REG-03 | Pass 25 Regression | Mixed | pass25 | Pass25 C-09 still PASS | PENDING |  |
| P25-REG-04 | Pass 25 Regression | Mixed | pass25 | Pass25 C-10 still PASS | PENDING |  |
| P25-REG-05 | Pass 25 Regression | Mixed | pass25 | Pass25 C-11 still PASS | PENDING |  |
| P25-REG-06 | Pass 25 Regression | Mixed | pass25 | Pass25 BH-01 still PASS | PENDING |  |
| P25-REG-07 | Pass 25 Regression | Mixed | pass25 | Pass25 BH-04 still PASS | PENDING |  |
| P25-REG-08 | Pass 25 Regression | Mixed | pass25 | Pass25 KB-01 still PASS | PENDING |  |
| P25-REG-09 | Pass 25 Regression | Mixed | pass25 | Pass25 KB-04 still PASS | PENDING |  |
| P25-REG-10 | Pass 25 Regression | Mixed | pass25 | Pass25 X-01 still PASS | PENDING |  |
| P25-REG-11 | Pass 25 Regression | Mixed | pass25 | Pass25 X-02 still PASS | PENDING |  |
| P25-REG-12 | Pass 25 Regression | Mixed | pass25 | Pass25 A-01 still PASS | PENDING |  |
| P25-REG-13 | Pass 25 Regression | Mixed | pass25 | Pass25 P0-05 still PASS | PENDING |  |
| P25-REG-14 | Pass 25 Regression | Mixed | pass25 | Pass25 BH-13 still PASS | PENDING |  |
| P25-REG-15 | Pass 25 Regression | Mixed | pass25 | Pass25 KB-10 still PASS | PENDING |  |
| P25-REG-16 | Pass 25 Regression | Mixed | pass25 | Pass25 C-02 still PASS | PENDING |  |
| P25-REG-17 | Pass 25 Regression | Mixed | pass25 | Pass25 C-03 still PASS | PENDING |  |
| P25-REG-18 | Pass 25 Regression | Mixed | pass25 | Pass25 C-07 still PASS | PENDING |  |
| P25-REG-19 | Pass 25 Regression | Mixed | pass25 | Pass25 C-08 still PASS | PENDING |  |
| P25-REG-20 | Pass 25 Regression | Mixed | pass25 | Pass25 C-12 still PASS | PENDING |  |

**Row count:** 180
