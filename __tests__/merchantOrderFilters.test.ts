import {
  filterOrdersByView,
  isActiveMerchantOrder,
  isOrderCollectible,
} from '@/domain/merchantOrderFilters';
import { countPickupWindowHandovers } from '@/lib/merchantHandoverCounts';
import type { MerchantOrdersView } from '@/domain/merchantOrdersView';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import type { MerchantOrderRow } from '@/hooks/useMerchantOrders';

function row(partial: Partial<MerchantOrderRow> & { id: string }): MerchantOrderRow {
  return {
    outlet_id: 'outlet-1',
    reservation_code: 'ABC123',
    status: 'paid',
    order_status_raw: 'paid',
    customer_name: 'Test',
    customer_phone: null,
    bag_title: 'Bag',
    bag_image_url: null,
    shelf_id: null,
    pickup_start: '2026-05-20T10:00:00.000Z',
    pickup_end: '2026-05-20T12:00:00.000Z',
    no_show_available: false,
    total: 500,
    created_at: '2026-05-20T09:00:00.000Z',
    payment_status: 'paid',
    customer_arrived_at: null,
    customer_on_the_way_at: null,
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

  it('ENDING_SOON: paid order ending within 2h appears in live-monitor and due-in-2h count', () => {
    const endingSoonNow = new Date('2026-05-20T11:00:00.000Z').getTime();
    const endingSoon = row({
      id: 'ending-soon',
      status: 'paid',
      pickup_start: '2026-05-20T10:30:00.000Z',
      pickup_end: '2026-05-20T12:30:00.000Z',
    });
    const live = filterOrdersByView([endingSoon], 'live-monitor', endingSoonNow);
    expect(live.map((o) => o.id)).toEqual(['ending-soon']);
    expect(countPickupWindowHandovers([endingSoon], endingSoonNow)).toBe(live.length);
  });

  it('review-pending is complement: excluded from verification, live-monitor, and late-pickups', () => {
    const fixture: MerchantOrderRow[] = [
      row({ id: 'v', status: 'paid', pickup_end: '2026-05-20T11:30:00.000Z' }),
      row({
        id: 'r',
        status: 'reserved',
        payment_status: 'pending',
        pickup_start: '2026-05-20T14:00:00.000Z',
        pickup_end: '2026-05-20T16:00:00.000Z',
      }),
      row({ id: 'l', status: 'paid', pickup_end: '2026-05-20T09:00:00.000Z' }),
      row({
        id: 'e',
        status: 'paid',
        pickup_start: '2026-05-20T10:30:00.000Z',
        pickup_end: '2026-05-20T12:30:00.000Z',
      }),
    ];
    const review = filterOrdersByView(fixture, 'review-pending', now);
    const reviewIds = new Set(review.map((o) => o.id));
    for (const id of reviewIds) {
      expect(filterOrdersByView(fixture, 'verification', now).some((o) => o.id === id)).toBe(false);
      expect(filterOrdersByView(fixture, 'live-monitor', now).some((o) => o.id === id)).toBe(false);
      expect(filterOrdersByView(fixture, 'late-pickups', now).some((o) => o.id === id)).toBe(false);
    }
    expect(reviewIds).toEqual(new Set(['r']));
  });

  it('active orders partition into actionable views without orphans', () => {
    const fixture: MerchantOrderRow[] = [
      row({ id: '1', status: 'paid', pickup_end: '2026-05-20T11:30:00.000Z' }),
      row({
        id: '2',
        status: 'reserved',
        payment_status: 'pending',
        pickup_start: '2026-05-20T14:00:00.000Z',
        pickup_end: '2026-05-20T16:00:00.000Z',
      }),
      row({ id: '3', status: 'paid', pickup_end: '2026-05-20T09:00:00.000Z' }),
      row({ id: '4', status: 'reserved', payment_status: 'paid', pickup_end: '2026-05-20T10:00:00.000Z' }),
    ];
    const active = fixture.filter((o) =>
      isActiveMerchantOrder(normalizeOrderStatus(o.status)),
    );
    const covered = new Set<string>();
    for (const view of ['verification', 'live-monitor', 'review-pending', 'late-pickups'] as const) {
      for (const o of filterOrdersByView(fixture, view, now)) {
        covered.add(o.id);
      }
    }
    for (const o of active) {
      expect(covered.has(o.id)).toBe(true);
    }
  });
});
