# Comprehensive plan YAML — closure evidence

This indexes the **Frozen plan** YAML (`106` ids enumerated in **`yaml-plan-ids.snapshot.txt`**). Executor pass landed matching artifacts inside `fresh-as-ever-mobile/` (navigation, hooks/tests, GH CI, investigations/runbooks/process docs).

## Phase 0 (**`p0-*`**)

| Theme | Artifact |
|------|-----------|
| Inventories (`p0-inv-*`) | `SCREEN_INVENTORY.md`, `HOOKS_INVENTORY.md`, `API_INVENTORY.md`, `MIDDLEWARE_MATRIX.md` |
| Route params (`p0-contract-route-params-artifact`) | `src/contracts/routeParams.ts` |
| Drift / ordering tests (`p0-ant-*`) | `__tests__/normalizeIncomingLinkPath.test.ts`, normalization comment in `linking.ts` |
| Hazard seeds (`p0-st-kickoff-hazards-seeded`) | `docs/investigations/phase-0-ST.md` + `HAZARD_REGISTER.md` |
| Server actions parity (`p0-inv-server-actions-…`) | `API_INVENTORY.md` appendix row |

## Phase 1 (**`p1-*`**)

| Theme | Artifact |
|------|-----------|
| Repo scaffold (`p1-scaffold-*`) | `ios/`, `android/`, `README.md`, `package.json` |
| Metro / babel (`p1-metro-*`, `p1-babel-*`) | `metro.config.js`, `babel.config.js` (`@/` alias, Hermes preset) |
| Env Zod gate (`p1-env-zod-*`) | `src/config/envSchema.ts` wired in `App.tsx` |
| Supabase persistence (`p1-supabase-*`) | `src/lib/supabase.ts` AsyncStorage adapter |
| Device smoke / Gradle / pods | `docs/investigations/device-smoke-matrix.md`, `docs/native/ANDROID_GRADLE_JVM.md`, README Pods |
| Metro cache premortems | `docs/runbooks/CLEAR_METRO_CACHE.md`, Xcode premortem `docs/investigations/xcode-premortem.md`, false-green playbook (device-matrix doc) |

## Phase 2 (**`p2-*`**)

| Theme | Artifact |
|------|-----------|
| Splash/auth overlay (`p2-nav-root-loading-boundary-overlay`) | `App.tsx` `AuthHydrateOverlay` |
| Customer checkout modal ergonomics (`p2-customer-tab-stack-checkout-modal-policy`) | `CheckoutScreen` `KeyboardAvoidingView` |
| Merchant/admin reset (`p2-merchant-admin-nav-isolation-reset-on-logout`) | `AuthContext.signOut` + `CommonActions.reset` |
| Deep links / queued replay | `.maestro/README.md`, `normalizeIncomingLinkPath.ts` tests |
| Universal links playbook | `AASA_AND_ASSETLINKS.md` |
| Android back / persisted nav docs | `docs/navigation/*.md` |
| Maestro regression matrix | README table + `.maestro/discover_smoke.yaml` |

## Phase 3 (**`p3-*`** batches)

Screens + stubs across `src/screens/**` aligned with Stitch inventory; Highlights:

- Discover forced states + marker uniqueness guard (`assertUniqueNearbyBagIds` dev hook).
- Marketing shells `WaitlistSuccess`, `ConnectionError`.
- Merchant finance/payout stubs, orders views, favourites/profile subtrees documented in `DEBT_WEB_ONLY_UX.md` where still thin vs web.
- Admin defer evidence in `ADMIN_DEFER.md`.

## Phase 4–5 (**data + PayHere**)

- Favourites optimistic add (`useFavourites.ts`), retry semantics still tied to refresh.
- PayHere POST timeout AbortController (`CheckoutScreen.tsx`), clock skew playbook `clock-skew-payhere.md`.
- RLS/copy audit backlog tracked inside `HOOKS_INVENTORY` + hazard register.

## Phase 6–7 + CI cross-cutting (**`p6-*`, `p7-*`, `vx-*`**)

| Item | Artifact |
|------|-----------|
| Error boundary (`vx-error-boundaries-*`) | `src/errors/RootErrorBoundary.tsx` wrapping `RootNavigator` |
| Global handlers (`vx-unhandled-rejection-global-handler-ant`) | `src/observability/installGlobalHandlers.ts` |
| CI (`vx-ci-*`) | `.github/workflows/mobile-ci.yml`, `npm run ci` |
| Gradle consumer rules commentary | `android/app/proguard-rules.pro`, note on okhttp |
| QE / release readiness | `docs/process/QE_LIGHTWEIGHT_CHECKLIST.md`, `RELEASE_CHECKLIST_ANDROID.md` |

## Operational / governance (**`ux-*`, `hosted-*`, `inv-*`**)

Weekly templates, QE sheets, OBS stub README links, rollback hotfixes, feature-flag registry captured under:

- `docs/process/WEEKLY_ROLLUP_TEMPLATE.md`
- `docs/observability/OBS_STUB_LINKS.md`
- `docs/feature-flags/FEATURE_FLAGS_REGISTRY.md`
- `docs/process/HOTFIX_PLAYBOOK.md` (see below)

`mandatory-sequential-thinking-mcp` ⇒ `SEQUENTIAL_THINKING_MCP_FALLBACK.md`.
