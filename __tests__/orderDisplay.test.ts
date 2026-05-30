import { orderDisplayTitle, orderPickupWindow } from '@/lib/orderDisplay';

describe('orderDisplay', () => {
  it('uses shelf item snapshots for shelf order titles', () => {
    expect(
      orderDisplayTitle({
        shelf_id: 'shelf-1',
        order_items: [{ name_snapshot: 'Bananas', quantity: 2 }],
      }),
    ).toBe('Bananas');
  });

  it('uses the shelf pickup window for shelf orders', () => {
    expect(
      orderPickupWindow({
        shelf_id: 'shelf-1',
        bag: {
          pickup_start: '2026-05-26T10:00:00.000Z',
          pickup_end: '2026-05-26T11:00:00.000Z',
        },
        shelf: {
          pickup_start: '2026-05-26T12:00:00.000Z',
          pickup_end: '2026-05-26T13:00:00.000Z',
        },
      }),
    ).toEqual({
      start: '2026-05-26T12:00:00.000Z',
      end: '2026-05-26T13:00:00.000Z',
    });
  });
});
