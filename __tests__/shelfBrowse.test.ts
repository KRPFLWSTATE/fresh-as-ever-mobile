import {
  applyBulkDiscountToItems,
  buildPublishChecklist,
  filterShelfItems,
  groupShelfItemsByCategory,
  sortShelfItems,
} from '@/lib/shelfBrowse';

describe('shelfBrowse', () => {
  const items = [
    { id: '1', name_snapshot: 'Milk', brand_snapshot: 'Anchor', rescue_price: 200, retail_price: 400, sort_order: 1, catalog_category: 'Dairy' },
    { id: '2', name_snapshot: 'Bread', rescue_price: 100, retail_price: 250, sort_order: 0, catalog_category: 'Bakery' },
    { id: '3', name_snapshot: 'Juice', brand_snapshot: 'Ceylon', rescue_price: 150, retail_price: 300, sort_order: 2 },
  ];

  it('filters by name and brand', () => {
    expect(filterShelfItems(items, 'anchor')).toHaveLength(1);
    expect(filterShelfItems(items, 'ju')).toHaveLength(1);
  });

  it('sorts by price and savings', () => {
    expect(sortShelfItems(items, 'price_asc').map((i) => i.id)).toEqual(['2', '3', '1']);
    expect(sortShelfItems(items, 'savings')[0]?.id).toBe('2');
  });

  it('groups by category with Other fallback', () => {
    const groups = groupShelfItemsByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(['Bakery', 'Dairy', 'Other']);
  });

  it('applies bulk discount from retail', () => {
    const out = applyBulkDiscountToItems(
      [{ retail_price: 1000, rescue_price: 500 }],
      25,
    );
    expect(out[0]?.rescue_price).toBe(750);
  });

  it('builds publish checklist', () => {
    const list = buildPublishChecklist({
      pickupStart: '2026-05-30T10:00:00',
      pickupEnd: '2026-05-30T14:00:00',
      itemCount: 2,
      itemsMissingRetail: 0,
      outletHalalCertified: true,
      nonHalalCount: 1,
    });
    expect(list.find((i) => i.id === 'halal')?.ok).toBe(false);
    expect(list.every((i) => i.id !== 'pickup' || i.ok)).toBe(true);
  });
});
