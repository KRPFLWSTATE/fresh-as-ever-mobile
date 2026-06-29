import {
  parseSettlementBreakdown,
  settlementMathConsistent,
} from '../src/lib/merchantSettlementBreakdown';
import { utcShelfDate } from '../src/lib/utcShelfDate';

describe('merchantSettlementBreakdown', () => {
  it('parses demo settlement and net math is consistent', () => {
    const breakdown = parseSettlementBreakdown({
      gross_sales: 9800,
      commission_amount: 1470,
      card_processing_fees: 120,
      cash_orders_commission_due: 220,
      net_payout: 7990,
    });
    expect(breakdown.net).toBe(7990);
    expect(settlementMathConsistent(breakdown)).toBe(true);
  });
});

describe('utcShelfDate', () => {
  it('uses UTC calendar date for shelf_date keys', () => {
    const d = new Date('2026-06-28T02:00:00.000Z');
    expect(utcShelfDate(d)).toBe('2026-06-28');
  });
});
