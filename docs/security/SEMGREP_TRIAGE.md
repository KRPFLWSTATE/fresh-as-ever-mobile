# Semgrep findings triage (2026-06-29)

Reference for Semgrep Cloud findings on `fresh-as-ever-mobile`. Re-scan locally:

```bash
semgrep scan --config p/security-audit --config p/javascript --config p/typescript --config p/react src/ ios/ android/
semgrep scan --config p/swift ios/FreshAsEverMobile/Info.plist   # ATS pinning rule (ignored below)
npm audit
~/.gem/ruby/*/bin/bundle-audit check   # or: gem install bundler-audit --user-install
```

## Fixed in code (commit b5ddfcd)

| Finding | Fix |
|---------|-----|
| ATS `NSAllowsLocalNetworking` in release | Removed from [`Info.plist`](../../ios/FreshAsEverMobile/Info.plist); Debug-only via Xcode `INFOPLIST_KEY_NSAppTransportSecurity_NSAllowsLocalNetworking`; [`app.config.js`](../../app.config.js) gates prebuild |
| `unsafe-formatstring` in logs | Constant format strings in [`supabaseError.ts`](../../src/lib/supabaseError.ts), [`logError.ts`](../../src/observability/logError.ts) |
| `fast-xml-parser`, `js-yaml`, `uuid` (npm) | `package.json` overrides; dev-tooling only |
| `concurrent-ruby` (Ruby) | Bumped to 1.3.7 in `Gemfile.lock` |
| `activesupport` 6.1.7.10 → 7.2.3.1 (3 CVEs) | Ruby minimum raised to 3.1; `.ruby-version` 3.4.4; `bundle-audit check` clean |

## Accepted risk / false positive (triage in Semgrep UI)

### Code — ATS public-key pinning

| Field | Value |
|-------|-------|
| **ID** | 867458689 |
| **Rule** | `swift.insecure-communication.ats.ats-pinning.ATS-consider-pinning` |
| **File** | `ios/FreshAsEverMobile/Info.plist` |
| **Severity** | Medium |
| **Semgrep autotriage** | False positive |
| **Disposition** | Documented; `.semgrepignore` entry |

**Justification:** Rule fires because `Info.plist` has no `NSPinnedDomains` / public-key pinning entries. Current ATS is restrictive (`NSAllowsArbitraryLoads` = false); no arbitrary-load or local-networking exceptions in release. Missing pinning is a hardening recommendation, not an exploitable misconfiguration. Pinning deferred due to cert-rotation operational cost (Supabase, Google Maps, Expo services).

### Code — exported MainActivity

| Field | Value |
|-------|-------|
| **Rule** | exported activity (Android) |
| **File** | `android/app/src/main/AndroidManifest.xml` |
| **Disposition** | `.semgrepignore` entry |

**Justification:** `MainActivity` must remain exported for launcher intent and `freshasever://` deep links. Activity exposes no privileged data.

### Supply chain — activesupport (fixed)

| ID | CVE | Rule title | Status |
|----|-----|------------|--------|
| 867458703 | CVE-2026-33169 | Inefficient Regular Expression Complexity | **Fixed** — `activesupport` 7.2.3.1 |
| 867458704 | CVE-2026-33170 | Cross-site Scripting | **Fixed** — `activesupport` 7.2.3.1 |
| 867458705 | CVE-2026-33176 | Uncontrolled Resource Consumption | **Fixed** — `activesupport` 7.2.3.1 |

**Remediation (2026-06-29):** Raised `Gemfile` Ruby minimum to `>= 3.1.0`, pinned `.ruby-version` to 3.4.4 (Homebrew `ruby@3.4`), and bumped `activesupport` to `>= 7.2.3.1`. Run `bundle install` with Ruby 3.1+ (not macOS system Ruby 2.6). `bundle-audit check` reports no vulnerabilities.

## Local verification (2026-06-29, post activesupport bump)

| Check | Result |
|-------|--------|
| `semgrep scan` (p/security-audit, p/javascript, p/typescript, p/react on src/ios/android) | **0 findings** |
| `semgrep scan --config p/swift Info.plist` | 1 finding (suppressed via `.semgrepignore`) |
| `npm audit` | **0 vulnerabilities** |
| `bundle-audit check` | **0 vulnerabilities** (`activesupport` 7.2.3.1) |

## Dev notes

- **Physical device + Metro:** Debug builds enable local networking via Xcode Debug config. Release/App Store builds do not.
- **Prebuild:** Set `NODE_ENV=production` or `EXPO_PUBLIC_ALLOW_LOCAL_NETWORKING=0` before `expo prebuild` for strict ATS.
