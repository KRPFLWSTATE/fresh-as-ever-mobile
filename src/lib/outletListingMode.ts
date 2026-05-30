export type OutletListingMode = 'rescue_bag' | 'clearance_shelf' | 'hybrid';

/** Merchant outlet editor options (no legacy `hotel` — use café + supermarket). */
export const MERCHANT_OUTLET_CATEGORIES = [
  { key: 'bakery', label: 'Bakery' },
  { key: 'cafe', label: 'Café' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'supermarket', label: 'Supermarket' },
  { key: 'hybrid', label: 'Bags & shelves' },
  { key: 'other', label: 'Other' },
] as const;

export function outletListingMode(category: string | null | undefined): OutletListingMode {
  const c = String(category ?? '').trim().toLowerCase();
  if (c === 'supermarket' || c === 'grocery' || c === 'groceries') {
    return 'clearance_shelf';
  }
  // Dual mode: explicit hybrid or legacy hotel rows.
  if (c === 'hybrid' || c === 'hotel') {
    return 'hybrid';
  }
  return 'rescue_bag';
}

export function canPublishRescueBags(category: string | null | undefined): boolean {
  const mode = outletListingMode(category);
  return mode === 'rescue_bag' || mode === 'hybrid';
}

export function canPublishClearanceShelves(category: string | null | undefined): boolean {
  const mode = outletListingMode(category);
  return mode === 'clearance_shelf' || mode === 'hybrid';
}
