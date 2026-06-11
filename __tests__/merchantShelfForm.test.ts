import { shelfItemsFromRow } from '@/lib/merchantShelfForm';

describe('merchantShelfForm', () => {
  it('hydrates catalog_category from category_snapshot for merchant editor parity', () => {
    const items = shelfItemsFromRow([
      {
        id: 'a',
        name_snapshot: 'Bread',
        rescue_price: 100,
        status: 'live',
        category_snapshot: 'Bakery',
        quantity_total: 2,
        quantity_remaining: 2,
      },
      {
        id: 'b',
        name_snapshot: 'Milk',
        rescue_price: 200,
        status: 'live',
        catalog_category: 'Dairy',
        quantity_total: 1,
        quantity_remaining: 1,
      },
    ]);

    expect(items[0]?.catalog_category).toBe('Bakery');
    expect(items[1]?.catalog_category).toBe('Dairy');
  });

  it('excludes removed shelf items', () => {
    const items = shelfItemsFromRow([
      { id: 'x', name_snapshot: 'Removed', rescue_price: 50, status: 'removed' },
      { id: 'y', name_snapshot: 'Live', rescue_price: 50, status: 'live' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.name_snapshot).toBe('Live');
  });
});
