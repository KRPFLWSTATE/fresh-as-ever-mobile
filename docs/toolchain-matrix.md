# Toolchain matrix (plan §W)

| File | Purpose | CI / check |
|------|---------|------------|
| `package.json` | Scripts, deps | `npm run lint`, `npm test` |
| `tsconfig.json` | TS strict | `npx tsc --noEmit` |
| `babel.config.js` | Hermes, plugins | implicit in bundle |
| `metro.config.js` | Resolver | `npx react-native bundle` |
| `jest.config.js` | Unit tests | `npm test` |
| `ios/Podfile` | Native iOS | `pod install` / Xcode build |
| `android/build.gradle` | Native Android | `./gradlew assembleDebug` |
| `.github/workflows/ci.yml` | Automation | PR gate |

Update this table when adding `react-native-config`, Maestro, or Detox.
