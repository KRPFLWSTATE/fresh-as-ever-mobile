import type { OutletListingMode } from '@/lib/outletListingMode';
import { orderListingKind } from '@/lib/orderDisplay';

export type OrderWithListingKind = {
  shelf_id?: string | null;
};

/** Restrict merchant order lists to the product types this outlet publishes. */
export function filterOrdersForListingMode<T extends OrderWithListingKind>(
  orders: T[],
  mode: OutletListingMode,
): T[] {
  if (mode === 'clearance_shelf') {
    return orders.filter((o) => orderListingKind(o) === 'shelf');
  }
  if (mode === 'rescue_bag') {
    return orders.filter((o) => orderListingKind(o) === 'bag');
  }
  return orders;
}
