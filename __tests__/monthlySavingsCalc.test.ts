import {
  calcMonthlySavingsFromOrders,
  calcOrderSavingsRs,
  isOrderInImpactPeriod,
  monthBoundsUtc,
  previousCalendarMonthKey,
} from '../src/lib/monthlySavingsCalc';

describe('monthlySavingsCalc', () => {
  it('resolves previous calendar month key in UTC', () => {
    expect(previousCalendarMonthKey(new Date('2026-06-15T12:00:00Z'))).toBe('2026-05');
    expect(previousCalendarMonthKey(new Date('2026-01-03T00:00:00Z'))).toBe('2025-12');
  });

  it('filters orders into month bounds via collected_at', () => {
    const { start } = monthBoundsUtc('2026-05');
    const inMonth = {
      order_status: 'collected',
      collected_at: new Date(start.getTime() + 86400000).toISOString(),
      shelf_id: 's1',
      order_items: [{ line_total: 100, unit_price: 100, quantity: 1 }],
    };
    const outMonth = {
      order_status: 'collected',
      collected_at: '2026-04-30T23:59:59Z',
      shelf_id: 's1',
      order_items: [{ line_total: 50, unit_price: 50, quantity: 1 }],
    };
    expect(isOrderInImpactPeriod(inMonth, '2026-05')).toBe(true);
    expect(isOrderInImpactPeriod(outMonth, '2026-05')).toBe(false);
  });

  it('mirrors bag savings math (retail − rescue) × quantity', () => {
    const saved = calcOrderSavingsRs({
      order_status: 'collected',
      quantity: 2,
      bag: { retail_value_estimate: 500, rescue_price: 200 },
    });
    expect(saved).toBe(600);
  });

  it('requires ≥2 rescues and saved > 0 for eligibility', () => {
    const periodKey = '2026-05';
    const base = {
      order_status: 'collected',
      collected_at: '2026-05-10T10:00:00Z',
      bag: { retail_value_estimate: 400, rescue_price: 250 },
      quantity: 1,
    };
    expect(calcMonthlySavingsFromOrders([base], periodKey).eligible).toBe(false);
    expect(
      calcMonthlySavingsFromOrders([base, { ...base, collected_at: '2026-05-12T10:00:00Z' }], periodKey)
        .eligible,
    ).toBe(true);
    expect(
      calcMonthlySavingsFromOrders(
        [
          {
            order_status: 'collected',
            collected_at: '2026-05-10T10:00:00Z',
            bag: { retail_value_estimate: 250, rescue_price: 250 },
            quantity: 1,
          },
          {
            order_status: 'collected',
            collected_at: '2026-05-12T10:00:00Z',
            bag: { retail_value_estimate: 250, rescue_price: 250 },
            quantity: 1,
          },
        ],
        periodKey,
      ).eligible,
    ).toBe(false);
  });

  it('sums shelf line totals like useCustomerImpact', () => {
    const summary = calcMonthlySavingsFromOrders(
      [
        {
          order_status: 'collected',
          collected_at: '2026-05-02T08:00:00Z',
          shelf_id: 's1',
          order_items: [{ line_total: 120, unit_price: 60, quantity: 2 }],
        },
        {
          order_status: 'resolved',
          collected_at: '2026-05-20T08:00:00Z',
          shelf_id: 's2',
          order_items: [{ line_total: 0, unit_price: 80, quantity: 1 }],
        },
      ],
      '2026-05',
    );
    expect(summary.rescueCount).toBe(2);
    expect(summary.savedRs).toBe(200);
    expect(summary.eligible).toBe(true);
  });
});
