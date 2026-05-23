import { haversineKm } from '@/lib/haversine';

describe('haversineKm', () => {
  test('returns 0 for identical points', () => {
    expect(haversineKm(6.9271, 79.8612, 6.9271, 79.8612)).toBeCloseTo(0, 6);
  });

  test('matches known great-circle distance: Colombo Fort → Galle Fort (~106 km)', () => {
    // Colombo Fort (6.9344°N, 79.8428°E) → Galle Fort (6.0535°N, 80.2210°E).
    // Great-circle ≈ 106.5 km. (Road distance is ~117 km but that's not what
    // haversine computes — it's straight-line on the sphere.)
    const km = haversineKm(6.9344, 79.8428, 6.0535, 80.221);
    expect(km).toBeGreaterThan(105);
    expect(km).toBeLessThan(108);
  });

  test('symmetric: swapping endpoints gives the same result', () => {
    const a = haversineKm(6.9271, 79.8612, 7.2906, 80.6337);
    const b = haversineKm(7.2906, 80.6337, 6.9271, 79.8612);
    expect(a).toBeCloseTo(b, 9);
  });

  test('half-kilometre drift threshold sanity (5×10⁻³° lat ≈ 0.555 km)', () => {
    const km = haversineKm(6.9271, 79.8612, 6.9321, 79.8612);
    expect(km).toBeGreaterThan(0.4);
    expect(km).toBeLessThan(0.7);
  });

  test('returns NaN for non-finite inputs (so callers can short-circuit)', () => {
    expect(haversineKm(Number.NaN, 1, 2, 3)).toBeNaN();
    expect(haversineKm(1, Number.NaN, 2, 3)).toBeNaN();
    expect(haversineKm(1, 2, Number.NaN, 3)).toBeNaN();
    expect(haversineKm(1, 2, 3, Number.POSITIVE_INFINITY)).toBeNaN();
  });
});
