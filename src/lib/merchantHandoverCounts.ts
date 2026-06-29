import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';
import {
  countOrdersForView,
  filterOrdersByView,
  isOrderCollectible,
} from '@/domain/merchantOrderFilters';
import { isPickupWindowOpen } from '@/domain/pickupWindow';

/** Orders ready for handover inside the current pickup window. */
export function countVerificationHandovers(rows: MerchantOrderRow[]): number {
  const now = Date.now();
  return filterOrdersByView(rows, 'verification', now).length;
}

/**
 * Pickups whose window ends within the next 2 hours ("Due in 2h").
 *
 * Single source of truth: this must always equal the Live monitor tab list
 * length, so it delegates to `filterOrdersByView(..., 'live-monitor')` rather
 * than re-deriving its own status/collectible predicate.
 */
export function countPickupWindowHandovers(
  rows: MerchantOrderRow[],
  nowMs: number = Date.now(),
): number {
  return countOrdersForView(rows, 'live-monitor', nowMs);
}

export function countLatePickups(rows: MerchantOrderRow[]): number {
  return countOrdersForView(rows, 'late-pickups');
}

export function countInWindowHandovers(rows: MerchantOrderRow[]): number {
  const now = Date.now();
  return rows.filter(
    (o) =>
      isOrderCollectible(o) &&
      isPickupWindowOpen(now, o.pickup_start, o.pickup_end),
  ).length;
}
