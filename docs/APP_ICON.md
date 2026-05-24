# Native app icon

Icons are generated from **`fresh-as-ever/public/logo.png`** (fork-tree + wordmark on cream).

| Platform | Path |
|----------|------|
| iOS | `ios/FreshAsEverMobile/Images.xcassets/AppIcon.appiconset/` |
| Android | `android/app/src/main/res/mipmap-*/ic_launcher.png` (+ `_round`) |

**Sizing rule:** fork-tree **mark-only** crop (center-top square) for icons ≤120px; full logo for iOS marketing 1024 and Android xxhdpi/xxxhdpi (≥144px).

## Rebuild

```bash
cd fresh-as-ever-mobile
# iOS
cd ios && pod install && cd ..
npx expo run:ios
# or open FreshAsEverMobile.xcworkspace in Xcode → Product → Clean Build Folder → Run

# Android
npx expo run:android
```

After replacing PNGs, uninstall the app from the simulator/device so the launcher cache refreshes.
