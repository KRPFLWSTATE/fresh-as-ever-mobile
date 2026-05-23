# RCTDeviceEventEmitter recovery

## Error

```
Failed to call RCTDeviceEventEmitter.emit()
Registered callable JavaScript modules (n = 0)
```

`n = 0` = JS bridge did not finish registering callable modules (Metro down, stale bundle, or crash during init).

## Recovery steps

1. Start Metro: `npx react-native start --reset-cache`
2. Simulator: Reload (⌘R); if red screen persists, quit app and relaunch
3. Hard clean: remove `ios/build`, clear DerivedData, reinstall on simulator
4. Confirm Metro shows bundle connected; check for earlier JS redbox in Metro logs

## App mitigations (consistency pass)

- `useUserLocation({ enabled })` — watcher only when Discover tab focused
- Place sheet: `KeyboardAvoidingView` + deferred `focusPlaceSearchInput` (capped retries)
- `index.js`: `expo-modules-core` before `AppRegistry`
