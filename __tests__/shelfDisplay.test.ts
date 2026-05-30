import {
  calcItemSavingsPercent,
  formatItemSavings,
  formatLowStock,
  formatUnitLabel,
  sumRetailSavingsForItems,
  formatBestBefore,
  formatPickupByLabel,
} from '@/lib/shelfDisplay';

describe('shelfDisplay', () => {
  describe('formatItemSavings', () => {
    it('returns percent string when retail exceeds rescue', () => {
      expect(formatItemSavings(1000, 600)).toBe('Save 40%');
    });

    it('returns null when retail missing or not greater than rescue', () => {
      expect(formatItemSavings(null, 600)).toBeNull();
      expect(formatItemSavings(500, 500)).toBeNull();
      expect(formatItemSavings(400, 500)).toBeNull();
    });

    it('calcItemSavingsPercent rounds correctly', () => {
      expect(calcItemSavingsPercent(799, 499)).toBe(38);
    });
  });

  describe('formatUnitLabel', () => {
    it('appends grams under 1kg', () => {
      expect(formatUnitLabel({ name: 'Yoghurt', weight_grams: 500 })).toBe('Yoghurt · 500g');
    });

    it('formats kilograms at 1000g+', () => {
      expect(formatUnitLabel({ name: 'Rice', weight_grams: 1000 })).toBe('Rice · 1kg');
      expect(formatUnitLabel({ name: 'Flour', weight_grams: 1500 })).toBe('Flour · 1.5kg');
    });

    it('returns name alone when no weight', () => {
      expect(formatUnitLabel({ name: 'Bananas' })).toBe('Bananas');
    });
  });

  describe('formatLowStock', () => {
    it('shows only N left for 1–3 units', () => {
      expect(formatLowStock(3)).toBe('Only 3 left');
      expect(formatLowStock(1)).toBe('Only 1 left');
    });

    it('returns null when stock is plentiful or sold out', () => {
      expect(formatLowStock(4)).toBeNull();
      expect(formatLowStock(0)).toBeNull();
    });
  });

  describe('formatBestBefore', () => {
    it('formats ISO date strings', () => {
      expect(formatBestBefore('2026-06-02')).toMatch(/Best before/);
    });

    it('returns null for empty input', () => {
      expect(formatBestBefore(null)).toBeNull();
    });
  });

  describe('formatPickupByLabel', () => {
    it('formats pickup by time', () => {
      const label = formatPickupByLabel('2026-05-30T18:30:00+05:30');
      expect(label).toMatch(/Pickup by/);
    });
  });

  describe('sumRetailSavingsForItems', () => {
    it('aggregates savings across qty map', () => {
      const items = [
        { id: 'a', retail_price: 1000, rescue_price: 700 },
        { id: 'b', retail_price: 500, rescue_price: 400 },
      ];
      expect(sumRetailSavingsForItems(items, { a: 2, b: 1 })).toBe(700);
    });

    it('ignores lines with zero qty or no retail', () => {
      const items = [{ id: 'a', retail_price: null, rescue_price: 100 }];
      expect(sumRetailSavingsForItems(items, { a: 1 })).toBe(0);
    });
  });
});
