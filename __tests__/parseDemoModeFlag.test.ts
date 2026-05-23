import { parseDemoModeFlag } from '@/config/parseDemoModeFlag';

describe('parseDemoModeFlag', () => {
  it('is false when unset or not the literal true', () => {
    expect(parseDemoModeFlag(undefined)).toBe(false);
    expect(parseDemoModeFlag(null)).toBe(false);
    expect(parseDemoModeFlag('')).toBe(false);
    expect(parseDemoModeFlag('false')).toBe(false);
    expect(parseDemoModeFlag('TRUE')).toBe(false);
    expect(parseDemoModeFlag('True')).toBe(false);
    expect(parseDemoModeFlag('1')).toBe(false);
    expect(parseDemoModeFlag('yes')).toBe(false);
  });

  it('is true only for exact trimmed "true"', () => {
    expect(parseDemoModeFlag('true')).toBe(true);
    expect(parseDemoModeFlag('  true  ')).toBe(true);
  });
});
