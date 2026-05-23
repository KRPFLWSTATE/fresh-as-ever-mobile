import type { MerchantOrdersView } from '@/domain/merchantOrdersView';
import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';
import { normalizeOrderStatus, ACTIVE_ORDER_STATUSES } from '@/lib/orderStatus';
import {
  isApproachingWithin2h,
  isLatePickup,
  isNoShowGraceElapsed,
  isPickupWindowOpen,
  lateSeverityFromMinutes,
  minutesPastPickupEnd,
  type LateSeverity,
} from '@/domain/pickupWindow';

export type { LateSeverity };

const ACTIVE_SET = new Set<string>([...ACTIVE_ORDER_STATUSES, 'awaiting_pickup']);

export function isActiveMerchantOrder(normalizedStatus: string): boolean {
  return ACTIVE_SET.has(normalizedStatus);
}

/** Collectible at counter: paid/awaiting_pickup or reserved with card/cash paid. */
export function isOrderCollectible(
  order: Pick<MerchantOrderRow, 'status' | 'order_status_raw' | 'payment_status'>,
): boolean {
  const st = normalizeOrderStatus(order.status);
  if (['paid', 'ready_for_pickup'].includes(st)) return true;
  if (st === 'reserved' && order.payment_status === 'paid') return true;
  return false;
}

export function filterOrdersByView(
  rows: MerchantOrderRow[],
  view: MerchantOrdersView,
  nowMs: number = Date.now(),
): MerchantOrderRow[] {
  if (view === 'all') {
    return rows.filter((o) => isActiveMerchantOrder(normalizeOrderStatus(o.status)));
  }

  return rows.filter((order) => {
    const st = normalizeOrderStatus(order.status);
    if (!isActiveMerchantOrder(st)) return false;

    if (view === 'live-monitor') {
      return isApproachingWithin2h(nowMs, order.pickup_end);
    }

    if (view === 'verification') {
      return (
        isPickupWindowOpen(nowMs, order.pickup_start, order.pickup_end) &&
        isOrderCollectible(order)
      );
    }

    if (view === 'review-pending') {
      if (isLatePickup(nowMs, order.pickup_end)) return false;
      if (isApproachingWithin2h(nowMs, order.pickup_end)) return false;
      if (isPickupWindowOpen(nowMs, order.pickup_start, order.pickup_end) && isOrderCollectible(order)) {
        return false;
      }
      if (st === 'reserved' && order.payment_status !== 'paid') return true;
      const start = order.pickup_start ? new Date(order.pickup_start).getTime() : null;
      if (isOrderCollectible(order) && start != null && !Number.isNaN(start) && nowMs < start) {
        return true;
      }
      return false;
    }

    if (view === 'late-pickups') {
      return isLatePickup(nowMs, order.pickup_end);
    }

    return true;
  });
}

export function countOrdersForView(
  rows: MerchantOrderRow[],
  view: MerchantOrdersView,
  nowMs: number = Date.now(),
): number {
  return filterOrdersByView(rows, view, nowMs).length;
}

export function sortLateOrders(rows: MerchantOrderRow[], nowMs: number = Date.now()): MerchantOrderRow[] {
  const severityRank: Record<string, number> = { critical: 0, moderate: 1, recent: 2 };
  return [...rows].sort((a, b) => {
    const ma = minutesPastPickupEnd(nowMs, a.pickup_end);
    const mb = minutesPastPickupEnd(nowMs, b.pickup_end);
    const sa = lateSeverityFromMinutes(ma) ?? 'recent';
    const sb = lateSeverityFromMinutes(mb) ?? 'recent';
    const dr = (severityRank[sa] ?? 9) - (severityRank[sb] ?? 9);
    if (dr !== 0) return dr;
    return mb - ma;
  });
}

export function filterLateBySeverity(
  rows: MerchantOrderRow[],
  chip: 'all' | 'critical' | 'moderate' | 'recent',
  nowMs: number = Date.now(),
): MerchantOrderRow[] {
  if (chip === 'all') return rows;
  return rows.filter((o) => {
    const sev = lateSeverityFromMinutes(minutesPastPickupEnd(nowMs, o.pickup_end));
    return sev === chip;
  });
}

export function lateSeverityCounts(rows: MerchantOrderRow[], nowMs: number = Date.now()) {
  let critical = 0;
  let moderate = 0;
  let recent = 0;
  for (const o of rows) {
    const sev = lateSeverityFromMinutes(minutesPastPickupEnd(nowMs, o.pickup_end));
    if (sev === 'critical') critical += 1;
    else if (sev === 'moderate') moderate += 1;
    else if (sev === 'recent') recent += 1;
  }
  return { critical, moderate, recent, total: rows.length };
}

export function isNoShowEligible(
  order: Pick<MerchantOrderRow, 'status' | 'pickup_end' | 'payment_status' | 'order_status_raw'>,
  nowMs: number = Date.now(),
): boolean {
  if (!isOrderCollectible(order)) return false;
  return isNoShowGraceElapsed(order.pickup_end, nowMs);
}

/** Late but customer may still collect. */
export function isLateHandoverEligible(order: MerchantOrderRow): boolean {
  return isOrderCollectible(order);
}
