import {
  CUSTOMER_IMPACT_ORDER_STATUSES,
  isCustomerArchivedOrderVisible,
  isCustomerOrderHistoryVisible,
  isCustomerRescueCompleted,
} from '../src/lib/customerRescueMetrics';

describe('customerRescueMetrics', () => {
  it('counts collected, completed, and resolved as completed rescues', () => {
    expect(isCustomerRescueCompleted('collected')).toBe(true);
    expect(isCustomerRescueCompleted('completed')).toBe(true);
    expect(isCustomerRescueCompleted('resolved')).toBe(true);
    expect(isCustomerRescueCompleted('paid')).toBe(false);
    expect(isCustomerRescueCompleted('cancelled')).toBe(false);
  });

  it('hides cancelled/refunded from payment history even when paid', () => {
    expect(isCustomerOrderHistoryVisible('cancelled', 'paid')).toBe(false);
    expect(isCustomerOrderHistoryVisible('refunded', 'paid')).toBe(false);
    expect(isCustomerOrderHistoryVisible('collected', 'paid')).toBe(true);
    expect(isCustomerOrderHistoryVisible('paid', 'paid')).toBe(true);
    expect(isCustomerOrderHistoryVisible('resolved', 'paid')).toBe(true);
  });

  it('archived tab shows completed rescues only', () => {
    expect(isCustomerArchivedOrderVisible('collected')).toBe(true);
    expect(isCustomerArchivedOrderVisible('resolved')).toBe(true);
    expect(isCustomerArchivedOrderVisible('cancelled')).toBe(false);
    expect(isCustomerArchivedOrderVisible('paid')).toBe(false);
  });

  it('impact query statuses include resolved', () => {
    expect(CUSTOMER_IMPACT_ORDER_STATUSES).toEqual([
      'collected',
      'completed',
      'resolved',
    ]);
  });
});
