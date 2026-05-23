/**
 * Map a raw `outlets.category` / `rescue_bags.category` enum value to a customer-facing
 * label. Falls back to a Title-Case rendering of the raw value when no friendly label
 * is registered, then to `'Saved Outlet'` when the value is empty.
 *
 * The mapping is shared by Discover, Favourites, and SearchResults so they stay aligned.
 */
const CATEGORY_LABELS: Record<string, string> = {
  bakery: 'Bakery',
  cafe: 'Café',
  café: 'Café',
  coffee: 'Café',
  restaurant: 'Restaurant',
  meal: 'Meals',
  meals: 'Meals',
  lunch: 'Meals',
  dinner: 'Meals',
  food: 'Meals',
  supermarket: 'Supermarket',
  grocery: 'Groceries',
  groceries: 'Groceries',
  produce: 'Groceries',
  veg: 'Groceries',
  hotel: 'Hotel',
  other: 'Saved Outlet',
};

export function categoryLabel(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return 'Saved Outlet';
  const direct = CATEGORY_LABELS[v];
  if (direct) return direct;
  // Title-case fallback for unknown enum values.
  return v.charAt(0).toUpperCase() + v.slice(1);
}
