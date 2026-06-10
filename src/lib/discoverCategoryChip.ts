export type DiscoverCategoryChipId =
  | 'all'
  | 'bakery'
  | 'cafe'
  | 'meals'
  | 'groceries'
  | 'supermarket';

/** Outlet categories that sell clearance shelves / grocery-style listings. */
const GROCERY_SHELF_CATEGORIES = new Set([
  'grocery',
  'groceries',
  'supermarket',
  'hybrid',
  'produce',
  'veg',
]);

/**
 * Whether an outlet `category` belongs on a Discover / Search category chip.
 * Groceries and Supermarket both include hybrid + supermarket enum values so
 * dual-mode demo outlets (e.g. Bakehouse) surface shelf cards on those filters.
 */
export function discoverCategoryMatchesChip(
  category: string | null | undefined,
  chip: DiscoverCategoryChipId,
): boolean {
  if (chip === 'all') return true;
  const c = String(category ?? '').trim().toLowerCase();
  if (!c) return false;
  switch (chip) {
    case 'bakery':
      return c.includes('bake') || c.includes('pastry') || c === 'bakery';
    case 'cafe':
      return c.includes('cafe') || c.includes('coffee');
    case 'meals':
      return (
        c.includes('meal') ||
        c.includes('lunch') ||
        c.includes('dinner') ||
        c.includes('food') ||
        c.includes('restaurant')
      );
    case 'groceries':
    case 'supermarket':
      if (GROCERY_SHELF_CATEGORIES.has(c)) return true;
      return chip === 'groceries'
        ? c.includes('groc') || c.includes('veg') || c.includes('produce')
        : c.includes('super') || c.includes('market');
    default:
      return false;
  }
}
