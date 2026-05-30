import { normalizeIncomingLinkPath } from '@/navigation/normalizeIncomingLinkPath';

describe('normalizeIncomingLinkPath (middleware parity)', () => {
  test('bags legacy /bag slug', () => {
    expect(normalizeIncomingLinkPath('bag/abc-123')).toBe('bags/abc-123');
    expect(normalizeIncomingLinkPath('/bag/zzz')).toBe('bags/zzz');
  });

  test('payout legacy', () => {
    expect(normalizeIncomingLinkPath('merchant/finance/payout/po1')).toBe(
      'merchant/payouts/po1',
    );
  });

  test('checkout draft segment', () => {
    expect(normalizeIncomingLinkPath('checkout/my-bag-draft')).toBe(
      'checkout?draft=my-bag-draft',
    );
  });

  test('merchant + admin shorthand', () => {
    expect(normalizeIncomingLinkPath('shelves/abc/review')).toBe(
      'shelves/abc/review',
    );
    expect(normalizeIncomingLinkPath('merchant')).toBe('merchant/dashboard');
    expect(normalizeIncomingLinkPath('admin')).toBe('admin/dashboard');
  });

  test('auth/login shorthand', () => {
    expect(normalizeIncomingLinkPath('auth/login')).toBe('login');
    expect(normalizeIncomingLinkPath('/auth/login')).toBe('login');
    expect(normalizeIncomingLinkPath('auth/login?ref=email')).toBe(
      'login?ref=email',
    );
  });

  test('support → profile/support', () => {
    expect(normalizeIncomingLinkPath('support')).toBe('profile/support');
    expect(normalizeIncomingLinkPath('/support')).toBe('profile/support');
  });

  test('profile/edit → profile/details', () => {
    expect(normalizeIncomingLinkPath('profile/edit')).toBe('profile/details');
    expect(normalizeIncomingLinkPath('/profile/edit')).toBe('profile/details');
  });

  test('forced discover states → query', () => {
    expect(normalizeIncomingLinkPath('discover/no-results')).toBe(
      'discover?state=no-results',
    );
    expect(normalizeIncomingLinkPath('discover/empty-search')).toBe(
      'discover?state=empty-search',
    );
    expect(normalizeIncomingLinkPath('discover/no-bags-nearby')).toBe(
      'discover?state=no-bags-nearby',
    );
    expect(normalizeIncomingLinkPath('discover/sold-out')).toBe(
      'discover?state=sold-out',
    );
    // case-insensitive match still produces lowercased query value.
    expect(normalizeIncomingLinkPath('discover/SOLD-OUT')).toBe(
      'discover?state=sold-out',
    );
  });

  test('reservation shortcuts → celebration', () => {
    expect(normalizeIncomingLinkPath('reservation/success/u1')).toBe(
      'order-celebration?orderId=u1&variant=reservation',
    );
    expect(normalizeIncomingLinkPath('rescue/confirmed/u2')).toBe(
      'order-celebration?orderId=u2&variant=rescue',
    );
  });

  test('merchant onboarding numeric steps', () => {
    expect(normalizeIncomingLinkPath('merchant/onboarding/step-4')).toBe(
      'merchant/onboarding?step=4',
    );
    expect(normalizeIncomingLinkPath('onboarding/step-2')).toBe(
      'onboarding?step=2',
    );
  });

  test('admin orders per-day drill-down', () => {
    expect(normalizeIncomingLinkPath('admin/orders/day/2026-05-08')).toBe(
      'admin/orders?day=2026-05-08',
    );
    expect(
      normalizeIncomingLinkPath('admin/orders/day/2026-05-08?ref=home'),
    ).toBe('admin/orders?day=2026-05-08&ref=home');
    // Non-ISO date doesn't match; falls through to default echo.
    expect(normalizeIncomingLinkPath('admin/orders/day/may-8')).toBe(
      'admin/orders/day/may-8',
    );
  });
});
