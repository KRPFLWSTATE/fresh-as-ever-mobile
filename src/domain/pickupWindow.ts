/** Pickup window helpers — single source for merchant order views and late pickups. */

const NO_SHOW_GRACE_MS = 30 * 60 * 1000;

export type LateSeverity = 'recent' | 'moderate' | 'critical' | null;

export function parsePickupMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Matches `customer_signal_arrival` RPC — 15 minutes before pickup_start. */
export const CUSTOMER_ARRIVAL_EARLY_MS = 15 * 60 * 1000;

/** Matches `customer_signal_on_the_way` RPC — 2 hours before pickup_start. */
export const CUSTOMER_ON_MY_WAY_EARLY_MS = 2 * 60 * 60 * 1000;

export function isPickupWindowOpen(
  nowMs: number,
  pickupStartIso: string | null | undefined,
  pickupEndIso: string | null | undefined,
): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return false;
  const start = parsePickupMs(pickupStartIso);
  if (start != null && nowMs < start) return false;
  return nowMs <= end;
}

/** Customer "I'm at the outlet" — same window as `customer_signal_arrival`. */
export function isCustomerArrivalEligible(
  nowMs: number,
  pickupStartIso: string | null | undefined,
  pickupEndIso: string | null | undefined,
): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null || nowMs > end) return false;
  const start = parsePickupMs(pickupStartIso);
  if (start != null && nowMs < start - CUSTOMER_ARRIVAL_EARLY_MS) return false;
  return true;
}

/** Customer "On my way" — same window as `customer_signal_on_the_way`. */
export function isCustomerOnMyWayEligible(
  nowMs: number,
  pickupStartIso: string | null | undefined,
  pickupEndIso: string | null | undefined,
): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null || nowMs > end) return false;
  const start = parsePickupMs(pickupStartIso);
  if (start != null && nowMs < start - CUSTOMER_ON_MY_WAY_EARLY_MS) return false;
  return true;
}

export function isApproachingWithin2h(nowMs: number, pickupEndIso: string | null | undefined): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return false;
  const horizon = nowMs + 2 * 60 * 60 * 1000;
  return end > nowMs && end <= horizon;
}

export function isLatePickup(nowMs: number, pickupEndIso: string | null | undefined): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return false;
  return nowMs > end;
}

export function minutesPastPickupEnd(nowMs: number, pickupEndIso: string | null | undefined): number {
  const end = parsePickupMs(pickupEndIso);
  if (end == null || nowMs <= end) return 0;
  return Math.floor((nowMs - end) / 60_000);
}

export function lateSeverityFromMinutes(minutesLate: number): LateSeverity {
  if (minutesLate <= 0) return null;
  if (minutesLate >= 30) return 'critical';
  if (minutesLate >= 15) return 'moderate';
  return 'recent';
}

export function isNoShowGraceElapsed(pickupEndIso: string | null | undefined, nowMs: number = Date.now()): boolean {
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return false;
  return nowMs >= end + NO_SHOW_GRACE_MS;
}

export function msUntilNoShowEligible(
  pickupEndIso: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return 0;
  return Math.max(0, end + NO_SHOW_GRACE_MS - nowMs);
}

export { NO_SHOW_GRACE_MS };

const PICKUP_TBC = 'Pickup time TBC';

const MERCHANT_TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

function pickupDayLabel(date: Date, now: Date): string {
  if (date.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Merchant orders — includes end-day when the window crosses midnight. */
export function formatMerchantPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!startIso || !endIso) return PICKUP_TBC;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return PICKUP_TBC;
  }
  const now = new Date(nowMs);
  const startDay = pickupDayLabel(start, now);
  const endDay = pickupDayLabel(end, now);
  const startTime = start.toLocaleTimeString(undefined, MERCHANT_TIME_FMT);
  const endTime = end.toLocaleTimeString(undefined, MERCHANT_TIME_FMT);
  if (start.toDateString() === end.toDateString()) {
    return `${startDay}, ${startTime} – ${endTime}`;
  }
  return `${startDay}, ${startTime} – ${endDay}, ${endTime}`;
}

/** Late pickups badge — human scale (avoid "781m" / label-caps "781M"). */
export function formatLatenessLabel(minutesLate: number): string {
  if (minutesLate <= 0) return 'Late';
  if (minutesLate < 60) return `${minutesLate}m late`;
  const hours = Math.floor(minutesLate / 60);
  const mins = minutesLate % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m late` : `${hours}h late`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h late` : `${days}d late`;
}

/** Human-readable pickup window for celebration and order detail surfaces. */
export function formatPickupLine(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!startIso || !endIso) return PICKUP_TBC;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return PICKUP_TBC;
  }
  const tf: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  const now = new Date(nowMs);
  const startDay = pickupDayLabel(start, now);
  const endDay = pickupDayLabel(end, now);
  const startTime = start.toLocaleTimeString(undefined, tf);
  const endTime = end.toLocaleTimeString(undefined, tf);
  if (start.toDateString() === end.toDateString()) {
    return `${startDay}, ${startTime} - ${endTime}`;
  }
  return `${startDay}, ${startTime} - ${endDay}, ${endTime}`;
}

/** When pickup opens (single start time) — human copy for errors and hints. */
export function formatPickupOpensAt(
  startIso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  const start = parsePickupMs(startIso);
  if (start == null) return 'Pickup time to be confirmed';
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 'Pickup time to be confirmed';
  const tf: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const today = new Date(nowMs);
  const dayPrefix =
    startDate.toDateString() === today.toDateString()
      ? 'Today'
      : startDate.toLocaleDateString('en-LK', { weekday: 'short' });
  return `Pickup opens at ${dayPrefix}, ${startDate.toLocaleTimeString('en-LK', tf)}`;
}
