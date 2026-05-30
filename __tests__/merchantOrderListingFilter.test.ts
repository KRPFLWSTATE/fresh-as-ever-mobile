import { filterOrdersForListingMode } from '@/lib/merchantOrderListingFilter';

describe('filterOrdersForListingMode', () => {
  const orders = [
    { id: '1', shelf_id: 's1' },
    { id: '2', shelf_id: null },
    { id: '3', shelf_id: null },
  ];

  it('keeps shelf orders for clearance_shelf outlets', () => {
    expect(filterOrdersForListingMode(orders, 'clearance_shelf')).toEqual([
      { id: '1', shelf_id: 's1' },
    ]);
  });

  it('keeps bag orders for rescue_bag outlets', () => {
    expect(filterOrdersForListingMode(orders, 'rescue_bag')).toEqual([
      { id: '2', shelf_id: null },
      { id: '3', shelf_id: null },
    ]);
  });

  it('returns all orders for hybrid outlets', () => {
    expect(filterOrdersForListingMode(orders, 'hybrid')).toHaveLength(3);
  });
});
