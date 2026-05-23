import {
  DISCOVER_FORCED_EMPTY_STATES,
  DISCOVER_EMPTY_COPY,
  parseDiscoverState,
} from '@/lib/discoverForcedState';

describe('discoverForcedState', () => {
  it('parses known state query values case-insensitively', () => {
    expect(parseDiscoverState('sold-out')).toBe('sold-out');
    expect(parseDiscoverState('SOLD-OUT')).toBe('sold-out');
    expect(parseDiscoverState('no-bags-nearby')).toBe('no-bags-nearby');
    expect(parseDiscoverState('  empty-search ')).toBe('empty-search');
  });

  it('returns null for unknown values', () => {
    expect(parseDiscoverState('')).toBeNull();
    expect(parseDiscoverState('random')).toBeNull();
    expect(parseDiscoverState(undefined)).toBeNull();
  });

  it('lists every forced state with title and body copy', () => {
    for (const key of DISCOVER_FORCED_EMPTY_STATES) {
      const row = DISCOVER_EMPTY_COPY[key];
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.body.length).toBeGreaterThan(0);
    }
  });
});
