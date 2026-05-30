const BAKERY_NAME_PATTERN = /bake|bakery|patisserie|café|cafe|coffee/i;
const SUPERMARKET_NAME_PATTERN = /supermarket/i;

const SUPERMARKET_CATEGORIES = new Set(['supermarket', 'grocery', 'groceries']);
const BAG_ONLY_CATEGORIES = new Set(['bakery', 'cafe', 'restaurant', 'other']);
const HYBRID_CATEGORIES = new Set(['hybrid', 'hotel']);

/** Stitch banner for the selected outlet category (always shown when a category is set). */
export function outletCategoryModeWarning(
  category: string | null | undefined,
): string | null {
  const cat = String(category ?? '').trim().toLowerCase();
  if (!cat) return null;

  if (SUPERMARKET_CATEGORIES.has(cat)) {
    return 'Clearance shelves only — customers will not see rescue bags on Discover.';
  }
  if (BAG_ONLY_CATEGORIES.has(cat)) {
    return 'Rescue bags only — customers will not see clearance shelves on Discover.';
  }
  if (HYBRID_CATEGORIES.has(cat)) {
    return 'Both rescue bags and clearance shelves — customers can browse bags and shelf items.';
  }
  return null;
}

/** Non-blocking warning when outlet name and category imply different listing modes. */
export function outletCategoryMismatchWarning(
  name: string | null | undefined,
  category: string | null | undefined,
): string | null {
  const label = String(name ?? '').trim();
  const cat = String(category ?? '').trim().toLowerCase();
  if (!label || !cat) return null;

  const bakeryLike = BAKERY_NAME_PATTERN.test(label);
  const supermarketLike = SUPERMARKET_NAME_PATTERN.test(label);

  if (SUPERMARKET_CATEGORIES.has(cat) && bakeryLike) {
    return 'Name sounds like a bakery or café, but category is Supermarket — customers will only see clearance shelves.';
  }
  if (BAG_ONLY_CATEGORIES.has(cat) && supermarketLike) {
    return 'Name sounds like a supermarket, but this category shows rescue bags only — not clearance shelves.';
  }
  if (HYBRID_CATEGORIES.has(cat) && supermarketLike && !bakeryLike) {
    return 'Name sounds like a supermarket — dual mode is correct if you sell both bags and shelf markdowns.';
  }
  return null;
}

/** Ordered Stitch warnings for outlet editor (mode first, then name mismatch). */
export function outletCategoryWarnings(
  name: string | null | undefined,
  category: string | null | undefined,
): string[] {
  const out: string[] = [];
  const mode = outletCategoryModeWarning(category);
  if (mode) out.push(mode);
  const mismatch = outletCategoryMismatchWarning(name, category);
  if (mismatch && !out.includes(mismatch)) out.push(mismatch);
  return out;
}
