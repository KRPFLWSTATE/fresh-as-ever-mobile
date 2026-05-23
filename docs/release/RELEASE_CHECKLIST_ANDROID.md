# Android release safeguards (**§ `p7-ant-debug-build-never-uploaded-to-stores-checklist-ant`**)

- Confirm `applicationIdSuffix` `.debug` not on release variant.
- `debuggable false` release build (`gradlew :app:bundleRelease`).
- Screenshots sanitized for PII (`§ p6-ant-screenshots-store-preview-leak-order-pii-ant`).
