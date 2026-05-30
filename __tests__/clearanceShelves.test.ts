import { resolveClearanceShelvesFlag } from '@/config/clearanceShelves';

describe('resolveClearanceShelvesFlag', () => {
  it('returns true when env is literal true', () => {
    expect(resolveClearanceShelvesFlag('true', false)).toBe(true);
  });

  it('returns false when env is explicit false even in dev', () => {
    expect(resolveClearanceShelvesFlag('false', true)).toBe(false);
  });

  it('defaults to true in dev when env is unset', () => {
    expect(resolveClearanceShelvesFlag(undefined, true)).toBe(true);
    expect(resolveClearanceShelvesFlag('', true)).toBe(true);
  });

  it('defaults to false in production when env is unset', () => {
    expect(resolveClearanceShelvesFlag(undefined, false)).toBe(false);
  });
});
