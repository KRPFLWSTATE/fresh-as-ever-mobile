# Native app icon

Icons are generated from **`assets/app-icon-source.png`** — mark-only fork-tree (no wordmark), extracted from the top of `fresh-as-ever/public/logo.png`. Replace this file with your own 1024×1024 PNG if you have a dedicated export.

| Platform | Path |
|----------|------|
| iOS | `ios/FreshAsEverMobile/Images.xcassets/AppIcon.appiconset/` |
| Android | `android/app/src/main/res/mipmap-*/ic_launcher.png` (+ `_round`) |

## Regenerate from master

```bash
cd fresh-as-ever-mobile
MASTER=assets/app-icon-source.png
IOS=ios/FreshAsEverMobile/Images.xcassets/AppIcon.appiconset
TMP=/tmp/fae-icon-square.png
cp "$MASTER" "$TMP"

gen() { sips -z "$2" "$2" "$TMP" --out "$1" >/dev/null; }
gen "$IOS/icon-20@2x.png" 40
gen "$IOS/icon-20@3x.png" 60
gen "$IOS/icon-29@2x.png" 58
gen "$IOS/icon-29@3x.png" 87
gen "$IOS/icon-40@2x.png" 80
gen "$IOS/icon-40@3x.png" 120
gen "$IOS/icon-60@2x.png" 120
gen "$IOS/icon-60@3x.png" 180
gen "$IOS/icon-1024.png" 1024

for spec in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  folder="${spec%%:*}"; size="${spec##*:}"
  dir="android/app/src/main/res/mipmap-$folder"
  mkdir -p "$dir"
  gen "$dir/ic_launcher.png" "$size"
  gen "$dir/ic_launcher_round.png" "$size"
done
```

## Rebuild

```bash
cd ios && pod install && cd ..
npm run ios
# or
npm run android
```

Uninstall the app from the simulator/device after replacing PNGs so the launcher cache refreshes.
