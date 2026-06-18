import {
  formatDiscoverCardSubtitle,
  formatOutletLandmarkSubtitle,
} from '@/lib/landmarkDisplay';

describe('landmarkDisplay', () => {
  it('formats card subtitle as Outlet · Area', () => {
    expect(formatOutletLandmarkSubtitle('Bakehouse Kollupitiya', 'Kollupitiya')).toBe(
      'Bakehouse Kollupitiya · Kollupitiya',
    );
  });

  it('falls back to outlet name only when landmark missing', () => {
    expect(formatOutletLandmarkSubtitle('Bakehouse Kollupitiya', null)).toBe(
      'Bakehouse Kollupitiya',
    );
  });

  it('gates landmark behind NEIGHBOURHOOD_BROWSE flag', () => {
    expect(
      formatDiscoverCardSubtitle('Bakehouse Kollupitiya', 'Kollupitiya', true),
    ).toBe('Bakehouse Kollupitiya · Kollupitiya');
    expect(
      formatDiscoverCardSubtitle('Bakehouse Kollupitiya', 'Kollupitiya', false),
    ).toBe('Bakehouse Kollupitiya');
  });
});
