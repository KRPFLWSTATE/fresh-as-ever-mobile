import { retailToKgProxy } from '@/lib/merchantAnalytics';

/** Stitch methodology: ~2.5 kg CO₂e per kg of rescued food. */
export const KG_CO2E_PER_KG_FOOD = 2.5;

export const DEFAULT_BAG_FOOD_WEIGHT_KG = 1;

/** Merchant quick-picks (kg); custom field allows any value in range. */
export const BAG_WEIGHT_PRESETS_KG = [
  0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5,
] as const;

export const MIN_BAG_WEIGHT_KG = 0.1;
export const MAX_BAG_WEIGHT_KG = 25;

export type BagWeightInput = {
  estimated_weight_kg?: number | string | null;
  retail_value_estimate?: number | string | null;
};

export function clampBagWeightKg(kg: number): number {
  if (!Number.isFinite(kg)) return DEFAULT_BAG_FOOD_WEIGHT_KG;
  return Math.min(
    MAX_BAG_WEIGHT_KG,
    Math.max(MIN_BAG_WEIGHT_KG, Math.round(kg * 100) / 100),
  );
}

export function parseBagWeightKgInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < MIN_BAG_WEIGHT_KG || n > MAX_BAG_WEIGHT_KG) {
    return null;
  }
  return clampBagWeightKg(n);
}

/** Food kg for one bag: merchant estimate → retail proxy → 1 kg default. */
export function resolveBagFoodWeightKg(bag: BagWeightInput | null | undefined): number {
  const direct = Number(bag?.estimated_weight_kg);
  if (Number.isFinite(direct) && direct > 0) {
    return clampBagWeightKg(direct);
  }
  return retailToKgProxy(
    bag?.retail_value_estimate != null
      ? Number(bag.retail_value_estimate)
      : null,
  );
}

/** Aggregate food kg (order totals) — do not clamp per-bag min/max here. */
export function co2eKgFromFoodKg(foodWeightKg: number): number {
  if (!Number.isFinite(foodWeightKg) || foodWeightKg <= 0) return 0;
  return Math.round(foodWeightKg * KG_CO2E_PER_KG_FOOD * 10) / 10;
}

export function co2eKgFromRescue({
  foodWeightKg,
  quantity = 1,
}: {
  foodWeightKg: number;
  quantity?: number;
}): number {
  const qty = Math.max(1, Number(quantity) || 1);
  return co2eKgFromFoodKg(foodWeightKg * qty);
}

export function co2eKgFromBagRescue(
  bag: BagWeightInput | null | undefined,
  quantity = 1,
): number {
  return co2eKgFromRescue({
    foodWeightKg: resolveBagFoodWeightKg(bag),
    quantity,
  });
}

export const DEFAULT_SHELF_ITEM_WEIGHT_KG = 0.2;

type ShelfOrderItemRow = {
  quantity?: number | string | null;
  weight_grams?: number | string | null;
  product?: { weight_grams?: number | string | null } | null;
};

export function co2eKgFromShelfOrderItems(
  orderItems: ShelfOrderItemRow[] | null | undefined,
): number {
  let totalKg = 0;
  for (const row of orderItems ?? []) {
    const qty = Math.max(1, Number(row.quantity) || 1);
    const grams = Number(row.product?.weight_grams ?? row.weight_grams);
    const kg =
      Number.isFinite(grams) && grams > 0
        ? grams / 1000
        : DEFAULT_SHELF_ITEM_WEIGHT_KG;
    totalKg += kg * qty;
  }
  return co2eKgFromFoodKg(totalKg);
}
