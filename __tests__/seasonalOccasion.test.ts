import {
  getActiveSeasonalWindows,
  getOccasionLabel,
  isDateInSeasonWindow,
  isOccasionWindowActive,
  listingMatchesOccasionFilter,
  parseSeasonalOccasionKind,
  shouldShowOccasionBadge,
  toSeasonDateKey,
  type SeasonalOccasionKind,
  type SeasonalOccasionWindow,
} from '@/domain/seasonalOccasion';

const avuruduWindow: SeasonalOccasionWindow = {
  occasion: 'avurudu',
  starts_on: '2026-04-10',
  ends_on: '2026-04-20',
  label: 'Avurudu',
};

const vesakWindow: SeasonalOccasionWindow = {
  occasion: 'vesak_dana',
  starts_on: '2026-05-11',
  ends_on: '2026-05-12',
  label: 'Vesak Dana',
};

describe('seasonalOccasion', () => {
  const windows = [avuruduWindow, vesakWindow];

  it('parses known occasion kinds', () => {
    expect(parseSeasonalOccasionKind('avurudu')).toBe('avurudu');
    expect(parseSeasonalOccasionKind('')).toBe('none');
    expect(parseSeasonalOccasionKind('unknown')).toBe('none');
  });

  it('detects active windows by calendar date', () => {
    const midAvurudu = new Date('2026-04-15T12:00:00');
    expect(isDateInSeasonWindow(midAvurudu, avuruduWindow)).toBe(true);
    expect(isOccasionWindowActive('avurudu', windows, midAvurudu)).toBe(true);
    expect(isOccasionWindowActive('vesak_dana', windows, midAvurudu)).toBe(false);
  });

  it('returns active windows for a date', () => {
    const midAvurudu = new Date('2026-04-15T12:00:00');
    expect(getActiveSeasonalWindows(windows, midAvurudu).map((w) => w.occasion)).toEqual([
      'avurudu',
    ]);
  });

  it('gates badge visibility behind feature flag and window', () => {
    const midAvurudu = new Date('2026-04-15T12:00:00');
    const offSeason = new Date('2026-06-18T12:00:00');
    expect(
      shouldShowOccasionBadge('avurudu', windows, true, midAvurudu),
    ).toBe(true);
    expect(
      shouldShowOccasionBadge('avurudu', windows, false, midAvurudu),
    ).toBe(false);
    expect(
      shouldShowOccasionBadge('avurudu', windows, true, offSeason),
    ).toBe(false);
    expect(shouldShowOccasionBadge('none', windows, true, midAvurudu)).toBe(false);
  });

  it('resolves display labels from window rows', () => {
    expect(getOccasionLabel('avurudu', windows)).toBe('Avurudu');
    expect(getOccasionLabel('none', windows)).toBeNull();
  });

  it('filters listings by occasion chip', () => {
    expect(listingMatchesOccasionFilter('avurudu', 'all')).toBe(true);
    expect(listingMatchesOccasionFilter('avurudu', 'avurudu')).toBe(true);
    expect(listingMatchesOccasionFilter('none', 'avurudu')).toBe(false);
  });

  it('formats local season date keys', () => {
    expect(toSeasonDateKey(new Date('2026-04-01T23:30:00'))).toBe('2026-04-01');
  });
});
