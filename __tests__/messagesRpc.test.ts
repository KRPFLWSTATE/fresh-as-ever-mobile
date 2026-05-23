import { ERROR } from '@/lib/messages/errors';
import {
  mapArrivalError,
  mapCheckoutError,
  mapHandoverError,
} from '@/lib/messages/rpc';
import { mapAuthError } from '@/lib/messages/auth';
import { mapSupabaseError } from '@/lib/supabaseError';

describe('messages rpc mappers', () => {
  it('maps handover RPC hints', () => {
    expect(mapHandoverError('order_not_ready')).toBe(ERROR.handover.notReady);
    expect(mapHandoverError('code_mismatch')).toBe(ERROR.handover.codeMismatch);
    expect(mapHandoverError('grace period')).toBe(ERROR.handover.grace);
  });

  it('maps arrival RPC hints', () => {
    expect(mapArrivalError('not_eligible_for_arrival')).toBe(
      ERROR.arrival.notEligible,
    );
    expect(mapArrivalError('payment_required')).toBe(ERROR.arrival.paymentFirst);
  });

  it('maps checkout sold-out hints', () => {
    expect(mapCheckoutError('bag sold out')).toBe(ERROR.checkout.soldOut);
    expect(mapCheckoutError('network fetch failed')).toBe(ERROR.common.network);
  });

  it('maps auth invalid credentials', () => {
    expect(mapAuthError('Invalid login credentials')).toBe(
      ERROR.auth.invalidCredentials,
    );
  });

  it('mapSupabaseError uses ERROR.common fallbacks', () => {
    expect(
      mapSupabaseError({
        code: '42501',
        message: 'permission denied',
        details: '',
        hint: '',
        name: 'PostgrestError',
      }),
    ).toBe(ERROR.common.permission);
    expect(mapSupabaseError(null)).toBe(ERROR.common.fallback);
  });
});
