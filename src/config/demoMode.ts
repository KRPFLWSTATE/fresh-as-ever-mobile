import { EXPO_PUBLIC_FAE_DEMO_MODE } from '@env';
import { getDevDemoModeOverride } from '@/config/demoModeDevOverride';
import { parseDemoModeFlag } from '@/config/parseDemoModeFlag';

/**
 * Investor / design-review merchant fixtures.
 *
 * **Release / App Store builds (`!__DEV__`):** always `false` — industry-standard
 * guard so demo rows never ship to production even if `.env` is mis-set.
 *
 * **Development (`__DEV__`):** optional **Profile → Developer** override (AsyncStorage)
 * wins over `.env` so QA can flip behaviour without Metro cache fights. When override
 * is “follow `.env`”, reads `@env` / `react-native-dotenv` from project-root `.env`
 * (see `babel.config.js`). Only the literal `true` (after trim) enables demo from env.
 */
export function isDemoMode(): boolean {
  if (!__DEV__) {
    return false;
  }
  const o = getDevDemoModeOverride();
  if (o === true) return true;
  if (o === false) return false;
  return parseDemoModeFlag(EXPO_PUBLIC_FAE_DEMO_MODE);
}
