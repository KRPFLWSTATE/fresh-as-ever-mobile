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

/** Human-readable pickup window for celebration and order detail surfaces. */
export function formatPickupLine(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
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
  const today = new Date();
  const dayPrefix =
    start.toDateString() === today.toDateString()
      ? 'Today'
      : start.toLocaleDateString(undefined, { weekday: 'short' });
  return `${dayPrefix}, ${start.toLocaleTimeString(undefined, tf)} - ${end.toLocaleTimeString(undefined, tf)}`;
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
