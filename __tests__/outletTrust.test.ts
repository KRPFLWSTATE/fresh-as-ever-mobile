import {
  computeOutletTrustScore,
  formatTrustScoreLabel,
} from '../src/lib/outletTrust';

describe('outletTrust', () => {
  it('returns null when order window is below minimum', () => {
    expect(
      computeOutletTrustScore({
        trustOrdersWindow: 4,
        averageRating: 4.5,
        collectionRatePct: 90,
      }),
    ).toBeNull();
  });

  it('computes rating-heavy trust score', () => {
    const score = computeOutletTrustScore({
      trustOrdersWindow: 10,
      averageRating: 4,
      collectionRatePct: 80,
      complaintRatePct: 10,
      noShowRatePct: 5,
    });
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(5);
  });

  it('formats new outlet label', () => {
    expect(formatTrustScoreLabel(null)).toBe('New outlet');
    expect(formatTrustScoreLabel(4.2)).toBe('4.2');
  });
});
