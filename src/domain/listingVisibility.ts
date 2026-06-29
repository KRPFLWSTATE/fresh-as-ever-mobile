/** Customer-visible listing predicates — shared contract across customer surfaces. */

export type BagVisibilityIssue =
  | 'not_live'
  | 'sold_out'
  | 'pickup_ended'
  | 'outlet_inactive'
  | 'merchant_not_approved'
  | 'demo_disabled';

export type ShelfVisibilityIssue =
  | 'not_published'
  | 'pickup_ended'
  | 'no_live_items'
  | 'outlet_inactive'
  | 'merchant_not_approved'
  | 'demo_disabled'
  | 'shelf_date_stale';

type OutletLike = Record<string, unknown> | undefined;

function parseIsoMs(iso: unknown): number | null {
  if (typeof iso !== 'string' || !iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function outletFromBag(bag: Record<string, unknown>): OutletLike {
  return bag.outlet as OutletLike;
}

function outletFromShelf(shelf: Record<string, unknown>): OutletLike {
  return shelf.outlet as OutletLike;
}

/** Hide listings from paused outlets or merchants that ops suspended/rejected. */
export function isOutletDiscoverVisible(outlet: OutletLike): boolean {
  if (!outlet) return false;
  if (outlet.is_active === false) return false;
  const merchant = outlet.merchant as Record<string, unknown> | undefined;
  if (!merchant?.status) return false;
  return String(merchant.status) === 'approved';
}

export function isDemoListingVisible(
  seedDemo: unknown,
  outlet: OutletLike,
): boolean {
  if (seedDemo !== true) return true;
  return outlet?.use_demo_listings !== false;
}

export function utcTodayIsoDate(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function isDemoShelfDateCurrent(
  shelf: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  if (shelf.seed_demo !== true) return true;
  const shelfDate = shelf.shelf_date;
  if (typeof shelfDate !== 'string' || !shelfDate) return false;
  return shelfDate === utcTodayIsoDate(nowMs);
}

function bagOutletChecks(
  bag: Record<string, unknown>,
): BagVisibilityIssue | null {
  const outlet = outletFromBag(bag);
  if (!isOutletDiscoverVisible(outlet)) {
    if (outlet?.is_active === false) return 'outlet_inactive';
    return 'merchant_not_approved';
  }
  if (!isDemoListingVisible(bag.seed_demo, outlet)) return 'demo_disabled';
  return null;
}

function shelfOutletChecks(
  shelf: Record<string, unknown>,
): ShelfVisibilityIssue | null {
  const outlet = outletFromShelf(shelf);
  if (!isOutletDiscoverVisible(outlet)) {
    if (outlet?.is_active === false) return 'outlet_inactive';
    return 'merchant_not_approved';
  }
  if (!isDemoListingVisible(shelf.seed_demo, outlet)) return 'demo_disabled';
  if (!isDemoShelfDateCurrent(shelf)) return 'shelf_date_stale';
  return null;
}

export function bagVisibilityIssue(
  bag: Record<string, unknown>,
  nowMs = Date.now(),
): BagVisibilityIssue | null {
  const status = String(bag.status ?? '').trim().toLowerCase();
  if (status !== 'live') return 'not_live';

  const qty = Number(bag.quantity_remaining ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return 'sold_out';

  const pickupEnd = parseIsoMs(bag.pickup_end);
  if (pickupEnd == null || pickupEnd <= nowMs) return 'pickup_ended';

  return bagOutletChecks(bag);
}

export function isBagCustomerVisible(
  bag: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  return bagVisibilityIssue(bag, nowMs) == null;
}

export function shelfVisibilityIssue(
  shelf: Record<string, unknown>,
  nowMs = Date.now(),
): ShelfVisibilityIssue | null {
  const status = String(shelf.status ?? '').trim().toLowerCase();
  if (status !== 'published') return 'not_published';

  const pickupEnd = parseIsoMs(shelf.pickup_end);
  if (pickupEnd == null || pickupEnd <= nowMs) return 'pickup_ended';

  const items = (shelf.items ?? shelf.clearance_shelf_items ?? []) as Record<
    string,
    unknown
  >[];
  const hasLive = items.some(
    (i) =>
      String(i.status ?? '').toLowerCase() === 'live' &&
      Number(i.quantity_remaining ?? 0) > 0,
  );
  if (!hasLive) return 'no_live_items';

  return shelfOutletChecks(shelf);
}

export function isShelfCustomerVisible(
  shelf: Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  return shelfVisibilityIssue(shelf, nowMs) == null;
}

export function bagVisibilityIssueLabel(issue: BagVisibilityIssue): string {
  switch (issue) {
    case 'not_live':
      return 'Not live';
    case 'sold_out':
      return 'Sold out';
    case 'pickup_ended':
      return 'Pickup ended';
    case 'outlet_inactive':
      return 'Outlet paused';
    case 'merchant_not_approved':
      return 'Merchant not approved';
    case 'demo_disabled':
      return 'Demo listings off';
    default:
      return 'Hidden from customers';
  }
}
