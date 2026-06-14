import { describePickupOverlapIssue, haveCommonPickupOverlap } from '@/lib/groupPickupOverlap';

describe('groupPickupOverlap', () => {
  it('allows a single bag', () => {
    expect(haveCommonPickupOverlap([{ pickup_start: '2026-06-10T10:00:00Z', pickup_end: '2026-06-10T12:00:00Z' }])).toBe(true);
  });

  it('detects overlapping windows', () => {
    expect(
      haveCommonPickupOverlap([
        { pickup_start: '2026-06-10T10:00:00Z', pickup_end: '2026-06-10T12:00:00Z' },
        { pickup_start: '2026-06-10T11:00:00Z', pickup_end: '2026-06-10T13:00:00Z' },
      ]),
    ).toBe(true);
  });

  it('blocks non-overlapping windows', () => {
    const windows = [
      { pickup_start: '2026-06-10T08:00:00Z', pickup_end: '2026-06-10T09:00:00Z' },
      { pickup_start: '2026-06-10T14:00:00Z', pickup_end: '2026-06-10T16:00:00Z' },
    ];
    expect(haveCommonPickupOverlap(windows)).toBe(false);
    expect(describePickupOverlapIssue(windows)).toMatch(/different pickup windows/i);
  });
});
