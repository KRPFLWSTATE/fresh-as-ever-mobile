import {
  isThemePreference,
  resolveColorScheme,
} from '@/theme/StitchThemeContext';

describe('resolveColorScheme', () => {
  test('explicit `light` preference forces light regardless of system', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('light', 'light')).toBe('light');
    expect(resolveColorScheme('light', null)).toBe('light');
    expect(resolveColorScheme('light', undefined)).toBe('light');
    expect(resolveColorScheme('light', 'unspecified')).toBe('light');
  });

  test('explicit `dark` preference forces dark regardless of system', () => {
    expect(resolveColorScheme('dark', 'dark')).toBe('dark');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('dark', null)).toBe('dark');
    expect(resolveColorScheme('dark', undefined)).toBe('dark');
    expect(resolveColorScheme('dark', 'unspecified')).toBe('dark');
  });

  test('`system` preference follows the OS scheme', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  test('`system` falls back to `light` when OS reports null / undefined / unspecified', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
    expect(resolveColorScheme('system', 'unspecified')).toBe('light');
  });
});

describe('isThemePreference', () => {
  test('accepts the three known string values', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference('LIGHT')).toBe(false);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(0)).toBe(false);
    expect(isThemePreference({})).toBe(false);
  });
});
