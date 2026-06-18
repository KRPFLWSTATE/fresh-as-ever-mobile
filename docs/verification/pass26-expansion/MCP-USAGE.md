# Pass 26 — MCP Usage by Gate

Map MCP tools to verification gates. See plan § MCP Inventory.

## Gate → MCP matrix

| Gate | Worker | Primary MCP | Tools | When |
|------|--------|-------------|-------|------|
| G0 Baseline | SA-BASELINE | user-supabase | `execute_sql` | Pre-pass26 JSON; per-stream pre/post migration |
| G0 Baseline | SA-BASELINE | user-Xcode MCP | `session_show_defaults` | Record project/scheme/sim before first build |
| G0 Baseline | SA-BASELINE | user-Official Appium MCP | `select_device`, `appium_geolocation` | P0 sim lock; Colombo geo |
| G1 Implement | SA-F1..F6 | user-supabase | `apply_migration`, `list_migrations` | DDL per stream (serial per migration file) |
| G1 Implement | SA-F1..F6 | user-Filesystem | read/write | Code only — not verification artifacts |
| G2a SQL | SA-F*-SQL | user-supabase | `execute_sql`, `get_advisors` | Post-migration proof; RPC smoke |
| G2b Web | SA-F*-WEB | user-Chrome DevTools | `navigate_page`, `take_snapshot`, `list_console_messages` | Customer/merchant/admin parity |
| G2b Web | SA-F*-WEB | user-Fetch | URL fetch | `wa.me`, deeplinks, cron routes |
| G3 Appium | SA-APPIUM-QUEUE | user-Official Appium MCP | `appium_session_management`, `appium_find_element`, `appium_gesture`, `appium_screenshot`, `appium_alert` | Serial sim marathon; dismiss Save Password |
| G3 Appium | SA-APPIUM-QUEUE | user-Xcode MCP | `build_run_sim`, `snapshot_ui` | Fresh bundle after mobile changes |
| G4 Cross | SA-CROSS-F* | user-supabase + Appium + Chrome DevTools | All above | 5-portal triangulation per TRIANGULATION.md |
| G5 Fix | SA-FIX-{ID} | Same as failing ID | — | Max 3 retries; Smart-Thinking if SQL≠UI |
| G6 Regression | SA-REGRESSION | Shell | `npm test`, `npm run typecheck` | Both repos |
| G6 Regression | SA-REGRESSION | user-supabase | `get_advisors` | Security + performance |
| G6 Audit | SA-AUDIT | user-Refactor (myuon) | `code_search` | Stale imports, flag defaults |

## Per-feature SQL smoke

| Feature | MCP query focus | Save to |
|---------|-----------------|---------|
| F1 | `pickup_window_kind` on demo bags/shelves | `baseline/f1-post.json` |
| F2 | N/A (client-only) | — |
| F3 | `outlets.landmark` 4/4 demo | `baseline/f3-post.json` |
| F4 | `seasonal_occasion_windows`, `occasion_kind` | `baseline/f4-post.json` |
| F5 | `customer_on_the_way_at`, RPC exists | `baseline/f5-post.json` |
| F6/F7 | `customer_notification_ledger`, dry-run LKR | `baseline/f7-post.json` |

## Do NOT use (Pass 26)

- `user-Lighthouse_Audits` — use Chrome DevTools `lighthouse_audit` instead
- `user-redis`, `user-SQLite` — no descriptors
- `user-Opik` — tracing only

## Project reference

- Supabase project ID: `odkbpeelvcdmlimdflbr`
- Sim UDID: `377DAC99-B79C-4B05-BB34-DBA1D160038D`
- Appium server: `http://127.0.0.1:4723`
