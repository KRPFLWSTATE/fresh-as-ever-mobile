import {
  customerPickupSignal,
  customerPickupSignalHeroLabel,
  customerPickupSignalLabel,
} from '@/domain/customerPickupSignals';

describe('customerPickupSignals', () => {
  it('prefers at_outlet over en_route', () => {
    expect(
      customerPickupSignal({
        customer_arrived_at: '2026-05-20T10:00:00.000Z',
        customer_on_the_way_at: '2026-05-20T09:30:00.000Z',
      }),
    ).toEqual({ kind: 'at_outlet' });
  });

  it('returns en_route when only on_the_way is set', () => {
    expect(
      customerPickupSignal({
        customer_on_the_way_at: '2026-05-20T09:30:00.000Z',
      }),
    ).toEqual({ kind: 'en_route' });
  });

  it('maps merchant labels', () => {
    expect(customerPickupSignalLabel({ kind: 'en_route' })).toBe('En route');
    expect(customerPickupSignalHeroLabel({ kind: 'en_route' })).toBe('On the way');
    expect(customerPickupSignalHeroLabel({ kind: 'at_outlet' })).toBe('Customer arrived');
  });
});
