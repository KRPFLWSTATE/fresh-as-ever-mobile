import { inferBagAllergensFromText } from '@/lib/bagAllergensFromText';

/**
 * Canonical allergen / dietary vocabulary for `rescue_bags` columns
 * (`allergens text[]`, `is_halal boolean`). See
 * `docs/supabase/rescue_bags_allergens_halal.sql`.
 */

export const RESCUE_BAG_ALLERGEN_COLUMNS = {
  allergens: 'allergens',
  isHalal: 'is_halal',
} as const;

/** Suggested values for `rescue_bags.allergens` (merchant-entered or inferred). */
export const BAG_ALLERGEN_LABELS = [
  'Gluten',
  'Dairy',
  'Egg',
  'Nuts',
  'Peanuts',
  'Soy',
  'Sesame',
  'Fish',
  'Shellfish',
] as const;

export type BagAllergenLabel = (typeof BAG_ALLERGEN_LABELS)[number];

export const BAG_DIETARY_FLAGS = ['vegan', 'vegetarian', 'halal'] as const;

export type BagDietaryFlag = (typeof BAG_DIETARY_FLAGS)[number];

/** Prefer structured DB columns; fall back to title/notes heuristics. */
export function resolveBagAllergensFromBag(
  bag: Record<string, unknown>,
  title: string,
  notes: string,
  outlet?: Record<string, unknown> | null,
): { allergens: string[]; isHalal: boolean | null } {
  const raw = bag.allergens;
  if (Array.isArray(raw) && raw.length > 0) {
    const allergens = raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    if (allergens.length > 0) {
      const bagHalal = typeof bag.is_halal === 'boolean' ? bag.is_halal : null;
      const outletHalal =
        outlet?.is_halal_certified === true ? true : null;
      return {
        allergens,
        isHalal: bagHalal ?? outletHalal,
      };
    }
  }
  const inferred = inferBagAllergensFromText(title, notes);
  const outletHalal =
    outlet?.is_halal_certified === true ? true : null;
  const bagHalal = typeof bag.is_halal === 'boolean' ? bag.is_halal : null;
  return {
    allergens: inferred.allergens,
    isHalal: bagHalal ?? outletHalal,
  };
}
