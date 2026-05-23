# Fresh as Ever — mobile (React Native)

Sibling app to the Next.js store. Customer discovery, checkout (PayHere WebView + cash), orders, merchant scaffold, admin placeholder.

## Setup

1. `npm ci`
2. Copy `.env.example` → `.env` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL` (see `docs/migration/HOSTED_API.md`).
3. iOS: from `ios/`, run `pod install` (see **CocoaPods paths** below).
4. `npm start` then `npm run ios` or `npm run android`.

## Scripts

- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm test` — Jest (mocks native modules; see `jest.setup.js`)
- **`npm run ci`** — typecheck → lint → test (parity with GitHub `mobile-ci` workflow).

## Troubleshooting runbooks

- **Metro stale cache**: `docs/runbooks/CLEAR_METRO_CACHE.md` (`§p1-ant-metro-cache`).
- **Linking parity tests**: `__tests__/normalizeIncomingLinkPath.test.ts`.
- **Plan YAML closure index**: `docs/migration/PLAN_TODO_EVIDENCE.md` (every Cursor plan id traced to artifact).

## Deep linking

Prefixes: `freshasever://`, `https://freshasever.com`, `https://www.freshasever.com`. Mapped in `src/navigation/linking.ts`.

## Device E2E (Maestro)

With a running build on device/emulator:

```bash
maestro test .maestro/discover_smoke.yaml
```

Smoke flow: launch app → assert main tab labels (Discover / Orders / Profile).

### Auth / role regression matrix (manual smoke)

| Scenario | Expected |
|----------|----------|
| Guest | `MainTabs`, Discover loads; Orders prompts sign-in |
| Customer sign-in | Orders list; checkout requires session |
| Suspended profile | Checkout redirects to Profile with suspended flag |
| Merchant staff | After sign-in (merchant portal), shell is `MerchantTabs` |
| Admin | Admin portal → `AdminShell` (`admin/*`); optional return to Discover |

## CocoaPods paths

If **`pod install` fails** with “bad component … path” / `React-Core-prebuilt` **Missing required attribute `source`**, the React Native **0.85** iOS toolchain often breaks when the project’s **absolute path contains spaces** (e.g. `.../Fresh as Ever/...`). **Symlinks alone do not help** Ruby usually resolves them to the real path with spaces.

**Fix:** move or rename so the repo lives under a path **without spaces** (this monorepo uses `Fresh-as-Ever`), then:

```bash
cd fresh-as-ever-mobile/ios && pod install
```

`pod install` should complete with **78 pods** and `FreshAsEverMobile.xcworkspace` — open that (not the bare `.xcodeproj`) in Xcode.

## Maps

`Discover` uses `react-native-maps`. Configure the **Google Maps SDK** / API keys per platform docs for production; default provider may work in simulator with limited tiles.
