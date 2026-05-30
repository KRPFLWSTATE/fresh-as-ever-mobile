/** Merchant/customer order title and pickup source for bag vs clearance shelf orders. */

export type OrderDisplaySource = {
  shelf_id?: string | null;
  bag?: {
    title?: string | null;
    pickup_start?: string | null;
    pickup_end?: string | null;
  } | null;
  order_items?: { name_snapshot?: string | null; quantity?: number | null }[] | null;
  shelf?: { pickup_start?: string | null; pickup_end?: string | null } | null;
  pickup_start?: string | null;
  pickup_end?: string | null;
};

export function orderListingKind(order: Pick<OrderDisplaySource, 'shelf_id'>): 'shelf' | 'bag' {
  return order.shelf_id ? 'shelf' : 'bag';
}

export function orderDisplayTitle(order: OrderDisplaySource): string {
  if (order.shelf_id) {
    const lines = order.order_items?.length ?? 0;
    if (lines === 1 && order.order_items?.[0]?.name_snapshot) {
      return String(order.order_items[0].name_snapshot);
    }
    return lines > 0
      ? `Clearance shelf · ${lines} item${lines === 1 ? '' : 's'}`
      : 'Clearance shelf order';
  }
  return order.bag?.title?.trim() || 'Rescue bag';
}

export function orderPickupWindow(order: OrderDisplaySource): {
  start: string | null;
  end: string | null;
} {
  if (order.shelf_id) {
    return {
      start: order.shelf?.pickup_start ?? order.pickup_start ?? null,
      end: order.shelf?.pickup_end ?? order.pickup_end ?? null,
    };
  }
  return {
    start: order.bag?.pickup_start ?? order.pickup_start ?? null,
    end: order.bag?.pickup_end ?? order.pickup_end ?? null,
  };
}
