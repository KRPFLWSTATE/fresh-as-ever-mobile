import {
  countWeeklyRescues,
  getWeekStartUtc,
  weeklyStreakProgress,
  WEEKLY_RESCUE_GOAL,
} from '@/lib/customerWeeklyStreak';

describe('customerWeeklyStreak', () => {
  it('uses Monday UTC week boundaries', () => {
    const wed = new Date('2026-06-10T12:00:00.000Z');
    const start = getWeekStartUtc(wed);
    expect(start.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('counts only completed orders in the reference week', () => {
    const ref = new Date('2026-06-10T12:00:00.000Z');
    const count = countWeeklyRescues(
      [
        { order_status: 'collected', collected_at: '2026-06-09T10:00:00.000Z' },
        { order_status: 'cancelled', collected_at: '2026-06-09T11:00:00.000Z' },
        { order_status: 'collected', collected_at: '2026-06-01T10:00:00.000Z' },
      ],
      ref,
    );
    expect(count).toBe(1);
  });

  it('reports progress toward weekly goal', () => {
    const progress = weeklyStreakProgress(
      [{ order_status: 'collected', collected_at: '2026-06-09T10:00:00.000Z' }],
      new Date('2026-06-10T12:00:00.000Z'),
    );
    expect(progress.goal).toBe(WEEKLY_RESCUE_GOAL);
    expect(progress.count).toBe(1);
    expect(progress.remaining).toBe(2);
    expect(progress.goalMet).toBe(false);
  });
});
