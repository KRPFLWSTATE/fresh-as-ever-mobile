/**
 * Dev-only override for {@link isDemoMode} (`src/config/demoMode.ts`).
 *
 * - `null` → follow `.env` (`EXPO_PUBLIC_FAE_DEMO_MODE`) via `parseDemoModeFlag`.
 * - `true` / `false` → hard wins in `__DEV__` only (release builds ignore demo mode entirely).
 *
 * Today this is in-memory only so `isDemoMode()` stays synchronous. When Profile → Developer
 * persists a choice to AsyncStorage, hydrate on app boot and call `setDevDemoModeOverride`.
 */
let devDemoModeOverride: boolean | null = null;

export function setDevDemoModeOverride(next: boolean | null): void {
  devDemoModeOverride = next;
}

export function getDevDemoModeOverride(): boolean | null {
  return devDemoModeOverride;
}
