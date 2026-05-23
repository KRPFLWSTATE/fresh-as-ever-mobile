/** Heuristic match to web `(customer)/bags/[id]/page.js` allergen inference. */

export type BagAllergensResult = {
  allergens: string[];
  dietary: string[];
};

export function inferBagAllergensFromText(
  title: string | null | undefined,
  notes: string | null | undefined,
): BagAllergensResult {
  const text = `${title ?? ''} ${notes ?? ''}`.toLowerCase();
  const detectedAllergens: string[] = [];
  if (/(nut|almond|cashew|peanut|pistachio)/.test(text)) {
    detectedAllergens.push('Nuts');
  }
  if (/(milk|cheese|cream|butter|yogurt)/.test(text)) {
    detectedAllergens.push('Dairy');
  }
  if (/(egg|omelette|mayo)/.test(text)) {
    detectedAllergens.push('Egg');
  }
  if (/(wheat|bread|croissant|pastry|bun|cake)/.test(text)) {
    detectedAllergens.push('Gluten');
  }

  const detectedDietary: string[] = [];
  if (/(vegan|plant)/.test(text)) {
    detectedDietary.push('Vegan-friendly options may be included');
  }
  if (/(vegetarian|veggie)/.test(text)) {
    detectedDietary.push('Vegetarian-friendly options may be included');
  }
  if (detectedDietary.length === 0) {
    detectedDietary.push(
      'Contents vary daily. Ask merchant for full ingredient list at pickup.',
    );
  }

  return {
    allergens:
      detectedAllergens.length > 0
        ? detectedAllergens
        : ['Allergen details vary by day'],
    dietary: detectedDietary,
  };
}
