import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';
import {
  countOrdersForView,
  filterOrdersByView,
  isOrderCollectible,
} from '@/domain/merchantOrderFilters';
import { isApproachingWithin2h, isPickupWindowOpen } from '@/domain/pickupWindow';
import { normalizeOrderStatus } from '@/lib/orderStatus';

/** Orders ready for handover inside the current pickup window. */
export function countVerificationHandovers(rows: MerchantOrderRow[]): number {
  const now = Date.now();
  return filterOrdersByView(rows, 'verification', now).length;
}

/** Pickups whose window ends within the next 2 hours (any active collectible status). */
export function countPickupWindowHandovers(rows: MerchantOrderRow[]): number {
  const now = Date.now();
  return rows.filter((o) => {
    const st = normalizeOrderStatus(o.status);
    if (!['reserved', 'paid', 'ready_for_pickup'].includes(st)) return false;
    if (!isApproachingWithin2h(now, o.pickup_end)) return false;
    return isOrderCollectible(o);
  }).length;
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
