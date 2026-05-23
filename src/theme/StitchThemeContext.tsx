import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  stitchAmbientShadow,
  stitchColorsDark,
  stitchColorsLight,
  stitchRadii,
  stitchSpacing,
  stitchTextRoleStyle,
  type StitchTextRole,
} from '@/theme/stitchTokens';
import { logError } from '@/observability/logError';

/** Runtime-resolved palette (light base keys; dark overrides some values). */
export type StitchResolvedPalette = typeof stitchColorsLight;

/**
 * User-selected appearance preference. `system` follows the OS color scheme,
 * `light` / `dark` are explicit overrides that survive app restarts.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export type ResolvedColorScheme = 'light' | 'dark';

export type StitchTheme = {
  mode: ResolvedColorScheme;
  /** Same value as `mode`; exposed under the React Native convention name. */
  colorScheme: ResolvedColorScheme;
  /** Raw user preference (system | light | dark). */
  themePreference: ThemePreference;
  /**
   * Persisted setter. Resolves once the write to AsyncStorage finishes (or fails
   * silently — the caller never needs to handle the error since the in-memory
   * state was already updated synchronously). Awaiting is only useful in tests.
   */
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  colors: StitchResolvedPalette;
  spacing: typeof stitchSpacing;
  radii: typeof stitchRadii;
  ambientShadow: typeof stitchAmbientShadow;
  textRole: (role: StitchTextRole) => ReturnType<typeof stitchTextRoleStyle>;
};

const StitchThemeContext = createContext<StitchTheme | null>(null);

/**
 * Key used to persist the user's appearance preference. Versioned (`.v1`) so we can
 * migrate the shape without colliding with stale clients.
 */
export const THEME_PREFERENCE_STORAGE_KEY = 'fae.themePreference.v1';

function resolvePalette(scheme: ResolvedColorScheme): StitchResolvedPalette {
  if (scheme !== 'dark') {
    return stitchColorsLight;
  }
  return stitchColorsDark as unknown as StitchResolvedPalette;
}

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

/**
 * Pure resolver: collapse a user preference + the live OS color scheme into a
 * concrete `'light' | 'dark'`. Exposed for unit testing. `null` /
 * `'unspecified'` (from `useColorScheme()` before the first OS callback or on
 * platforms that don't report) are treated as `'light'`.
 *
 * Accepts the full `ColorSchemeName` from RN (`'light' | 'dark' | 'unspecified'
 * | null | undefined`) so callers can pass `useColorScheme()`'s return value
 * directly without narrowing.
 */
export function resolveColorScheme(
  pref: ThemePreference,
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): ResolvedColorScheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function StitchThemeProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const systemScheme = useColorScheme();
  /**
   * Start in `system` so the very first frame matches OS. We hydrate from AsyncStorage
   * in an effect; if the persisted value is `light`/`dark`, the second render swaps
   * the palette. There's no flash-of-wrong-theme in practice because both light and
   * dark mount the same JS tree — only the token map changes.
   */
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>('system');
  /**
   * Defensive guard for future consumers. Persistence happens **inside** the
   * `setThemePreference` setter (not via an effect on `themePreference`), so the
   * current implementation cannot clobber a saved value with the `'system'`
   * default on first paint. We still track the hydration state so any future
   * autosave-on-change effect (or an internal sanity check) can read it via
   * `hydratedRef.current` and short-circuit until the read settles.
   */
  const hydratedRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw != null && isThemePreference(raw)) {
          setThemePreferenceState(raw);
        }
      })
      .catch((err) => {
        logError(err, { context: 'StitchThemeProvider.hydrate' });
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemePreference = useCallback(
    async (next: ThemePreference): Promise<void> => {
      setThemePreferenceState(next);
      try {
        await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next);
      } catch (err) {
        logError(err, { context: 'StitchThemeProvider.persist' });
      }
    },
    [],
  );

  const resolvedScheme: ResolvedColorScheme = useMemo(
    () => resolveColorScheme(themePreference, systemScheme),
    [themePreference, systemScheme],
  );

  const value = useMemo((): StitchTheme => {
    return {
      mode: resolvedScheme,
      colorScheme: resolvedScheme,
      themePreference,
      setThemePreference,
      colors: resolvePalette(resolvedScheme),
      spacing: stitchSpacing,
      radii: stitchRadii,
      ambientShadow: stitchAmbientShadow,
      textRole: stitchTextRoleStyle,
    };
  }, [resolvedScheme, themePreference, setThemePreference]);

  return (
    <StitchThemeContext.Provider value={value}>
      {children}
    </StitchThemeContext.Provider>
  );
}

export function useStitchTheme(): StitchTheme {
  const ctx = useContext(StitchThemeContext);
  if (!ctx) {
    throw new Error('useStitchTheme must be used inside StitchThemeProvider');
  }
  return ctx;
}
