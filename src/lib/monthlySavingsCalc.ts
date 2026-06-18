import { CUSTOMER_IMPACT_ORDER_STATUSES } from '@/lib/customerRescueMetrics';

export const MONTHLY_SAVINGS_MIN_RESCUES = 2;

export type MonthlySavingsOrderRow = {
  quantity?: number | string | null;
  order_status?: string | null;
  shelf_id?: string | null;
  collected_at?: string | null;
  updated_at?: string | null;
  bag?: {
    retail_value_estimate?: number | string | null;
    rescue_price?: number | string | null;
  } | null;
  order_items?: {
    quantity?: number | string | null;
    line_total?: number | string | null;
    unit_price?: number | string | null;
  }[] | null;
};

const IMPACT_STATUS_SET = new Set<string>(CUSTOMER_IMPACT_ORDER_STATUSES);

/** Previous calendar month in UTC, e.g. `2026-05`. */
export function previousCalendarMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (m === 0) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** UTC bounds for a `YYYY-MM` period key (inclusive start, exclusive end). */
export function monthBoundsUtc(periodKey: string): { start: Date; end: Date } {
  const [yRaw, mRaw] = periodKey.split('-');
  const year = Number(yRaw);
  const month = Number(mRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`invalid_period_key:${periodKey}`);
  }
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0, 0));
  return { start, end };
}

export function orderCompletedAtMs(row: MonthlySavingsOrderRow): number | null {
  const raw = row.collected_at ?? row.updated_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isOrderInImpactPeriod(
  row: MonthlySavingsOrderRow,
  periodKey: string,
): boolean {
  const status = String(row.order_status ?? '').trim().toLowerCase();
  if (!IMPACT_STATUS_SET.has(status)) return false;
  const completedMs = orderCompletedAtMs(row);
  if (completedMs == null) return false;
  const { start, end } = monthBoundsUtc(periodKey);
  return completedMs >= start.getTime() && completedMs < end.getTime();
}

/** Mirror `useCustomerImpact` savings math for one order row. */
export function calcOrderSavingsRs(row: MonthlySavingsOrderRow): number {
  if (row.shelf_id) {
    let saved = 0;
    for (const line of row.order_items ?? []) {
      const lineTotal = Number(line.line_total) || 0;
      const unit = Number(line.unit_price) || 0;
      const qty = Math.max(1, Number(line.quantity) || 1);
      saved += lineTotal > 0 ? lineTotal : unit * qty;
    }
    return saved;
  }

  const q = Math.max(1, Number(row.quantity) || 1);
  const bag =
    typeof row.bag === 'object' && row.bag != null ? row.bag : {};
  const retail = Number(bag.retail_value_estimate) || 0;
  const rescue = Number(bag.rescue_price) || 0;
  if (retail > 0 && rescue >= 0) {
    return Math.max(0, retail - rescue) * q;
  }
  return 0;
}

export function rescueCountForOrder(row: MonthlySavingsOrderRow): number {
  if (row.shelf_id) return 1;
  return Math.max(1, Number(row.quantity) || 1);
}

export type MonthlySavingsSummary = {
  periodKey: string;
  rescueCount: number;
  savedRs: number;
  eligible: boolean;
};

/** Aggregate month slice savings — same rules as push notification eligibility. */
export function calcMonthlySavingsFromOrders(
  orders: MonthlySavingsOrderRow[],
  periodKey: string,
): MonthlySavingsSummary {
  let rescueCount = 0;
  let saved = 0;
  for (const row of orders) {
    if (!isOrderInImpactPeriod(row, periodKey)) continue;
    rescueCount += rescueCountForOrder(row);
    saved += calcOrderSavingsRs(row);
  }
  const savedRs = Math.round(saved);
  return {
    periodKey,
    rescueCount,
    savedRs,
    eligible: rescueCount >= MONTHLY_SAVINGS_MIN_RESCUES && savedRs > 0,
  };
}
