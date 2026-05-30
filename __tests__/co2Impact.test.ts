import {
  BAG_WEIGHT_PRESETS_KG,
  clampBagWeightKg,
  co2eKgFromBagRescue,
  co2eKgFromRescue,
  parseBagWeightKgInput,
  resolveBagFoodWeightKg,
} from '../src/lib/co2Impact';

describe('co2Impact', () => {
  it('uses merchant estimated_weight_kg when set', () => {
    expect(
      resolveBagFoodWeightKg({
        estimated_weight_kg: 2,
        retail_value_estimate: 800,
      }),
    ).toBe(2);
  });

  it('falls back to retail proxy then default', () => {
    expect(resolveBagFoodWeightKg({ retail_value_estimate: 800 })).toBe(1);
    expect(resolveBagFoodWeightKg(null)).toBe(1);
  });

  it('co2e from rescue uses 2.5 factor per kg food', () => {
    expect(co2eKgFromRescue({ foodWeightKg: 2, quantity: 1 })).toBe(5);
    expect(co2eKgFromRescue({ foodWeightKg: 1, quantity: 3 })).toBe(7.5);
  });

  it('co2eKgFromBagRescue', () => {
    expect(
      co2eKgFromBagRescue({ estimated_weight_kg: 1.5 }, 2),
    ).toBe(7.5);
  });

  it('parseBagWeightKgInput and clamp', () => {
    expect(parseBagWeightKgInput('1,5')).toBe(1.5);
    expect(parseBagWeightKgInput('0.05')).toBeNull();
    expect(clampBagWeightKg(99)).toBe(25);
    expect(BAG_WEIGHT_PRESETS_KG).toContain(0.2);
    expect(BAG_WEIGHT_PRESETS_KG).toContain(1);
  });
});
