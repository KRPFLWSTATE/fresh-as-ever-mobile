# Semgrep findings triage (2026-06-29)

Reference for Semgrep Cloud findings on `fresh-as-ever-mobile`. Re-scan locally:

```bash
semgrep scan --config p/security-audit --config p/javascript --config p/typescript --config p/react src/ ios/ android/
npm audit
```

## Fixed in code

| Finding | Fix |
|---------|-----|
| ATS `NSAllowsLocalNetworking` in release | Removed from [`Info.plist`](../ios/FreshAsEverMobile/Info.plist); Debug-only via Xcode `INFOPLIST_KEY_NSAppTransportSecurity_NSAllowsLocalNetworking`; [`app.config.js`](../app.config.js) gates prebuild |
| `unsafe-formatstring` in logs | Constant format strings in [`supabaseError.ts`](../src/lib/supabaseError.ts), [`logError.ts`](../src/observability/logError.ts) |
| `fast-xml-parser`, `js-yaml`, `uuid` (npm) | `package.json` overrides; dev-tooling only |
| `concurrent-ruby` (Ruby) | Bumped to 1.3.7 in `Gemfile.lock` |

## Accepted risk (triage in Semgrep UI)

| Finding | Reason |
|---------|--------|
| ATS public-key pinning | Hardening recommendation; HTTPS-only ATS. Pinning deferred (cert rotation ops). |
| Exported `MainActivity` | Required for launcher + `freshasever://` deep links; no privileged data in activity. |
| `activesupport` 6.1.7.10 (3 CVEs) | CocoaPods build-time only; no patch on 6.1.x line; upgrade blocked by `cocoapods-core` `< 8`. Monitor Rails 7.2.3.1+ when CocoaPods allows. |

## Dev notes

- **Physical device + Metro:** Debug builds enable local networking via Xcode Debug config. Release/App Store builds do not.
- **Prebuild:** Set `NODE_ENV=production` or `EXPO_PUBLIC_ALLOW_LOCAL_NETWORKING=0` before `expo prebuild` for strict ATS.
