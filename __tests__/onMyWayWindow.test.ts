import {
  CUSTOMER_ARRIVAL_EARLY_MS,
  CUSTOMER_ON_MY_WAY_EARLY_MS,
  isCustomerArrivalEligible,
  isCustomerOnMyWayEligible,
} from '@/domain/pickupWindow';

const t = (iso: string) => new Date(iso).getTime();

describe('onMyWayWindow', () => {
  const start = '2026-05-20T10:00:00.000Z';
  const end = '2026-05-20T12:00:00.000Z';

  it('opens 2 hours before pickup_start', () => {
    const early = new Date(t(start) - CUSTOMER_ON_MY_WAY_EARLY_MS + 60_000).toISOString();
    expect(isCustomerOnMyWayEligible(t(early), start, end)).toBe(true);
    expect(isCustomerOnMyWayEligible(t('2026-05-20T07:30:00.000Z'), start, end)).toBe(false);
  });

  it('closes after pickup_end', () => {
    expect(isCustomerOnMyWayEligible(t('2026-05-20T12:30:00.000Z'), start, end)).toBe(false);
  });

  it('is wider than arrival window before pickup_start', () => {
    const betweenWindows = new Date(
      t(start) - CUSTOMER_ARRIVAL_EARLY_MS - 30 * 60_000,
    ).toISOString();
    expect(isCustomerOnMyWayEligible(t(betweenWindows), start, end)).toBe(true);
    expect(isCustomerArrivalEligible(t(betweenWindows), start, end)).toBe(false);
  });

  it('allows both signals inside arrival window', () => {
    const inside = '2026-05-20T10:30:00.000Z';
    expect(isCustomerOnMyWayEligible(t(inside), start, end)).toBe(true);
    expect(isCustomerArrivalEligible(t(inside), start, end)).toBe(true);
  });
});

describe('customerSignalOnTheWay eligibility (client mirror of RPC)', () => {
  type CollectibleOrder = {
    status: string;
    paymentStatus: string;
    pickupStart: string;
    pickupEnd: string;
    customerOnTheWayAt: string | null;
    customerArrivedAt: string | null;
    nowMs: number;
  };

  function canSignalOnTheWay(order: CollectibleOrder): boolean {
    const normalized = order.status;
    const paymentStatus = order.paymentStatus.toLowerCase();
    const collectible =
      ['reserved', 'paid', 'ready_for_pickup'].includes(normalized) &&
      (normalized !== 'reserved' || paymentStatus === 'paid');
    return (
      collectible &&
      !order.customerOnTheWayAt &&
      isCustomerOnMyWayEligible(order.nowMs, order.pickupStart, order.pickupEnd)
    );
  }

  function canSignalArrival(order: CollectibleOrder): boolean {
    const normalized = order.status;
    const paymentStatus = order.paymentStatus.toLowerCase();
    const collectible =
      ['reserved', 'paid', 'ready_for_pickup'].includes(normalized) &&
      (normalized !== 'reserved' || paymentStatus === 'paid');
    return (
      collectible &&
      !order.customerArrivedAt &&
      isCustomerArrivalEligible(order.nowMs, order.pickupStart, order.pickupEnd)
    );
  }

  const base: CollectibleOrder = {
    status: 'paid',
    paymentStatus: 'paid',
    pickupStart: '2026-05-20T10:00:00.000Z',
    pickupEnd: '2026-05-20T12:00:00.000Z',
    customerOnTheWayAt: null,
    customerArrivedAt: null,
    nowMs: t('2026-05-20T08:30:00.000Z'),
  };

  it('allows on my way without setting arrived', () => {
    expect(canSignalOnTheWay(base)).toBe(true);
    expect(canSignalArrival(base)).toBe(false);
  });

  it('blocks duplicate on my way when timestamp already set', () => {
    expect(
      canSignalOnTheWay({
        ...base,
        customerOnTheWayAt: '2026-05-20T08:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('allows arrival after on my way inside arrival window', () => {
    const withOnTheWay = {
      ...base,
      customerOnTheWayAt: '2026-05-20T08:00:00.000Z',
      nowMs: t('2026-05-20T10:30:00.000Z'),
    };
    expect(canSignalOnTheWay(withOnTheWay)).toBe(false);
    expect(canSignalArrival(withOnTheWay)).toBe(true);
  });

  it('requires paid reserved orders', () => {
    expect(
      canSignalOnTheWay({
        ...base,
        status: 'reserved',
        paymentStatus: 'pending',
      }),
    ).toBe(false);
  });
});
