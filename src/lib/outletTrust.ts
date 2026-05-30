/** Client-side mirror of outlet trust_score formula (for tests / optional live fallback). */

export type OutletTrustInput = {
  averageRating?: number | null;
  collectionRatePct?: number | null;
  complaintRatePct?: number | null;
  noShowRatePct?: number | null;
  trustOrdersWindow?: number | null;
};

const MIN_ORDERS = 5;

export function computeOutletTrustScore(input: OutletTrustInput): number | null {
  const window = Number(input.trustOrdersWindow ?? 0);
  if (!Number.isFinite(window) || window < MIN_ORDERS) {
    return null;
  }

  const star = Number(input.averageRating);
  const starNorm = Number.isFinite(star) && star > 0 ? star : 3.5;

  const cPct = Number(input.collectionRatePct ?? 0);
  const cRate = Math.max(0, Math.min(1, cPct / 100));

  const cmpPct = Number(input.complaintRatePct ?? 0);
  const cmpRate = Math.max(0, Math.min(1, 1 - cmpPct / 100));

  const nsPct = Number(input.noShowRatePct ?? 0);
  const nsRate = Math.max(0, Math.min(1, 1 - nsPct / 100));

  const trust = Math.round(
    (0.6 * starNorm +
      0.2 * cRate * 5 +
      0.1 * cmpRate * 5 +
      0.1 * nsRate * 5) *
      100,
  ) / 100;

  return Math.max(0, Math.min(5, trust));
}

export function formatTrustScoreLabel(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) {
    return 'New outlet';
  }
  return Number(score).toFixed(1);
}
