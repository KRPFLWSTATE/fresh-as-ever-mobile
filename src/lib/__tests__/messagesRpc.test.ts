import { mapArrivalError, mapCheckoutError, mapHandoverError } from '@/lib/messages/rpc';
import { ERROR } from '@/lib/messages/errors';

describe('messages rpc mappers', () => {
  it('maps handover grace and readiness', () => {
    expect(mapHandoverError('order_not_ready')).toBe(ERROR.handover.notReady);
    expect(mapHandoverError('30 minute grace')).toBe(ERROR.handover.grace);
    expect(mapHandoverError('code_mismatch')).toBe(ERROR.handover.codeMismatch);
  });

  it('maps arrival eligibility', () => {
    expect(mapArrivalError('not_eligible for window')).toBe(ERROR.arrival.notEligible);
    expect(mapArrivalError('payment required')).toBe(ERROR.arrival.paymentFirst);
  });

  it('maps checkout sold out', () => {
    expect(mapCheckoutError('bag sold out')).toBe(ERROR.checkout.soldOut);
    expect(mapCheckoutError('clearance_item_sold_out', ERROR.checkout.reserveFailed, 'shelf')).toBe(
      ERROR.checkout.shelfSoldOut,
    );
    expect(mapCheckoutError('fetch failed')).toBe(ERROR.common.network);
  });
});
