import { EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED } from '@env';

/** Pure resolver — exported for unit tests. */
export function resolveClearanceShelvesFlag(
  raw: unknown,
  isDev: boolean = __DEV__,
): boolean {
  const value = String(raw ?? '').trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return isDev;
}

/**
 * Clearance Shelf feature flag (supermarket item-level listings).
 *
 * Reads `@env` / `react-native-dotenv` from project-root `.env` (see `babel.config.js`).
 * Literal `true` enables; explicit `false` disables everywhere.
 * When unset, defaults to enabled in `__DEV__` so outlet save → shelves works locally
 * without Metro cache fights. Production builds require
 * `EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED=true`.
 */
export function isClearanceShelvesEnabled(): boolean {
  return resolveClearanceShelvesFlag(EXPO_PUBLIC_CLEARANCE_SHELVES_ENABLED);
}
