# Device & Hermes smoke matrix (**§ `p1-fast-refresh-physical-device-matrix`**)

| Target | Scenario | Artifact |
|--------|----------|----------|
| iOS Simulator | Fast refresh sanity | Xcode |
| Physical iPhone | Deeplink handshake | Xcode device console |
| Android Emulator | Back stack + Checkout WebView | `adb logcat` |

False-green CI follow-up playbook: rerun `npm ci` locally if CI-only failures (`§ p1-ant-false-green-ci-smoke-followup`).
