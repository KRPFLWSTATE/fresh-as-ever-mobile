import {
  aggregateHourBuckets,
  aggregateTopBags,
  countDistinctCustomers,
  estimateWasteKg,
  isCollectedOrder,
  retailToKgProxy,
  sumRevenue,
  sumSurplusRecovered,
} from '../src/lib/merchantAnalytics';

describe('merchantAnalytics', () => {
  it('counts distinct customers', () => {
    expect(
      countDistinctCustomers([
        { customer_id: 'a' },
        { customer_id: 'b' },
        { customer_id: 'a' },
      ]),
    ).toBe(2);
  });

  it('sums revenue', () => {
    expect(sumRevenue([{ total: 100 }, { total: '50' }])).toBe(150);
  });

  it('aggregates hour buckets', () => {
    const d = new Date();
    d.setHours(14, 0, 0, 0);
    const buckets = aggregateHourBuckets([{ created_at: d.toISOString() }]);
    expect(buckets[14].count).toBe(1);
  });

  it('aggregates top bags by revenue', () => {
    const top = aggregateTopBags([
      {
        bag_id: '1',
        total: 200,
        quantity: 1,
        bag: { title: 'Bread' },
      },
      {
        bag_id: '1',
        total: 100,
        quantity: 1,
        bag: { title: 'Bread' },
      },
      { bag_id: '2', total: 150, quantity: 1, bag: { title: 'Cake' } },
    ]);
    expect(top[0].bagId).toBe('1');
    expect(top[0].revenue).toBe(300);
    expect(top[0].units).toBe(2);
  });

  it('estimates waste kg from bag map', () => {
    const kg = estimateWasteKg(
      [{ bag_id: 'x', quantity: 2 }],
      new Map([['x', 1.5]]),
    );
    expect(kg).toBe(3);
  });

  it('retailToKgProxy', () => {
    expect(retailToKgProxy(800)).toBe(1);
    expect(retailToKgProxy(null)).toBe(1);
  });

  it('isCollectedOrder', () => {
    expect(isCollectedOrder('collected')).toBe(true);
    expect(isCollectedOrder('reserved')).toBe(false);
  });

  it('sumSurplusRecovered skips null/zero retail', () => {
    expect(
      sumSurplusRecovered([
        { quantity: 2, bag: { retail_value_estimate: 500 } },
        { quantity: 1, bag: { retail_value_estimate: null } },
        { quantity: 1, bag: { retail_value_estimate: 0 } },
      ]),
    ).toBe(1000);
  });

  it('sumSurplusRecovered multiplies by quantity', () => {
    expect(
      sumSurplusRecovered([{ quantity: 3, bag: { retail_value_estimate: 100 } }]),
    ).toBe(300);
  });
});
