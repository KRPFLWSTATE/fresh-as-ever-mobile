# Universal links playbook (**§ `p2-universal-ios-aasa-fetched-signed`, `p2-android-dal-fetch-adb-matrix`**)

1. **iOS**: Host `apple-app-site-association` over HTTPS matching prefix list in `src/navigation/linking.ts`.
2. **Android**: Maintain `assetlinks.json` verifying Digital Asset Links fingerprints.
3. **QA**: fuzz deep links `/bag/:id`, `/merchant/finance/payout/:pid`, `/checkout/:draft`.

Deferred link replay & Maestro: `.maestro/README.md`.
