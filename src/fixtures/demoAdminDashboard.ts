/**
 * Demo-only admin dashboard trend seed (`isDemoMode()` / `__DEV__` only).
 * Merged into the 7-day orders chart when live `orders` returns no rows in the window.
 */

export type DemoOrderTrendRow = { created_at: string; total?: number };

/** Deterministic per-day order counts for the admin “Orders this week” chart. */
const DEMO_DAILY_ORDER_COUNTS = [4, 6, 5, 9, 11, 8, 7] as const;

const DEMO_DAILY_SETTLED_REVENUE = [4200, 6100, 5400, 9800, 11200, 8700, 7600] as const;

/**
 * Build synthetic `orders` rows with `created_at` spread across each day in the trend window.
 */
export function buildDemoAdminOrderTrendRows(
  trendStart: Date,
  dayCount: number,
): DemoOrderTrendRow[] {
  const rows: DemoOrderTrendRow[] = [];
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(trendStart);
    day.setDate(trendStart.getDate() + i);
    const count = DEMO_DAILY_ORDER_COUNTS[i % DEMO_DAILY_ORDER_COUNTS.length];
    const revenueEach =
      DEMO_DAILY_SETTLED_REVENUE[i % DEMO_DAILY_SETTLED_REVENUE.length] / Math.max(1, count);
    for (let j = 0; j < count; j++) {
      const ts = new Date(day);
      ts.setHours(9 + (j % 10), (j * 7) % 60, 0, 0);
      rows.push({
        created_at: ts.toISOString(),
        total: Math.round(revenueEach),
      });
    }
  }
  return rows;
}
