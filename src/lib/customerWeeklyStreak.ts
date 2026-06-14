import { isCustomerRescueCompleted } from '@/lib/customerRescueMetrics';

/** Weekly rescue goal shown on Impact + Profile. */
export const WEEKLY_RESCUE_GOAL = 3;

export type WeeklyStreakOrderRow = {
  collected_at?: string | null;
  created_at?: string | null;
  order_status?: string | null;
};

/** ISO week starts Monday 00:00 UTC. */
export function getWeekStartUtc(reference: Date): Date {
  const d = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function getWeekEndUtc(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

function resolveCollectedAt(row: WeeklyStreakOrderRow): number | null {
  const raw = row.collected_at ?? row.created_at;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** Count completed rescues whose collection falls in the reference week. */
export function countWeeklyRescues(
  orders: WeeklyStreakOrderRow[],
  referenceDate: Date = new Date(),
): number {
  const weekStart = getWeekStartUtc(referenceDate).getTime();
  const weekEnd = getWeekEndUtc(getWeekStartUtc(referenceDate)).getTime();
  return orders.filter((o) => {
    if (!isCustomerRescueCompleted(o.order_status)) return false;
    const t = resolveCollectedAt(o);
    if (t == null) return false;
    return t >= weekStart && t < weekEnd;
  }).length;
}

export function weeklyStreakProgress(
  orders: WeeklyStreakOrderRow[],
  referenceDate: Date = new Date(),
): {
  count: number;
  goal: number;
  remaining: number;
  goalMet: boolean;
  progress: number;
} {
  const count = countWeeklyRescues(orders, referenceDate);
  const goal = WEEKLY_RESCUE_GOAL;
  const remaining = Math.max(0, goal - count);
  const goalMet = count >= goal;
  const progress = Math.min(1, count / goal);
  return { count, goal, remaining, goalMet, progress };
}
