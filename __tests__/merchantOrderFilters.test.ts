import { filterOrdersByView, isOrderCollectible } from '@/domain/merchantOrderFilters';
import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';

function row(partial: Partial<MerchantOrderRow> & { id: string }): MerchantOrderRow {
  return {
    reservation_code: 'ABC123',
    status: 'paid',
    order_status_raw: 'paid',
    customer_name: 'Test',
    customer_phone: null,
    bag_title: 'Bag',
    bag_image_url: null,
    pickup_start: '2026-05-20T10:00:00.000Z',
    pickup_end: '2026-05-20T12:00:00.000Z',
    no_show_available: false,
    total: 500,
    created_at: '2026-05-20T09:00:00.000Z',
    payment_status: 'paid',
    customer_arrived_at: null,
    ...partial,
  };
}

const now = new Date('2026-05-20T11:00:00.000Z').getTime();

describe('merchantOrderFilters', () => {
  const orders = [
    row({ id: '1', status: 'paid', pickup_end: '2026-05-20T11:30:00.000Z' }),
    row({ id: '2', status: 'reserved', payment_status: 'pending', pickup_start: '2026-05-20T14:00:00.000Z', pickup_end: '2026-05-20T16:00:00.000Z' }),
    row({ id: '3', status: 'paid', pickup_end: '2026-05-20T09:00:00.000Z' }),
    row({ id: '4', status: 'reserved', payment_status: 'paid', pickup_end: '2026-05-20T10:00:00.000Z' }),
  ];

  it('verification: in-window collectible only', () => {
    const v = filterOrdersByView(orders, 'verification', now);
    expect(v.map((o) => o.id)).toEqual(['1']);
  });

  it('late-pickups: past pickup_end', () => {
    const v = filterOrdersByView(orders, 'late-pickups', now);
    expect(v.map((o) => o.id).sort()).toEqual(['3', '4']);
  });

  it('reserved+paid is collectible', () => {
    expect(isOrderCollectible(row({ id: 'x', status: 'reserved', payment_status: 'paid' }))).toBe(true);
  });
});
