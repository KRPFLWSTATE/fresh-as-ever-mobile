import {
  fetchPayHereHash,
  PayHereApiError,
} from '@/lib/payhereApi';
import { ERROR } from '@/lib/messages/errors';

describe('fetchPayHereHash', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('rejects when API_BASE_URL is empty', async () => {
    await expect(fetchPayHereHash('', 'token', { order_id: 'o1', amount: 100 })).rejects.toMatchObject({
      message: ERROR.checkout.paymentApiUnreachable,
      code: 'unreachable',
    });
  });

  it('returns hash payload on success', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          hash: 'ABC123',
          merchant_id: 'M1',
          amount: '2900.00',
          currency: 'LKR',
        }),
    });

    const data = await fetchPayHereHash('https://api.test', 'token', {
      order_id: 'o1',
      amount: 2900,
    });

    expect(data.hash).toBe('ABC123');
    expect(data.merchant_id).toBe('M1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test/api/payhere/hash',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('surfaces HTML 405 as unreachable without calling res.json()', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 405,
      text: async () => '<html><body>405 Not Allowed</body></html>',
    });

    await expect(
      fetchPayHereHash('https://freshasever.com', 'token', { order_id: 'o1', amount: 100 }),
    ).rejects.toMatchObject({
      message: ERROR.checkout.paymentApiUnreachable,
      code: 'invalid_response',
    });
  });

  it('maps API JSON errors', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Unauthorized' }),
    });

    await expect(
      fetchPayHereHash('https://api.test', 'token', { order_id: 'o1', amount: 100 }),
    ).rejects.toMatchObject({
      message: 'Unauthorized',
      code: 'api_error',
    });
  });

  it('maps fetch network failure as unreachable', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      fetchPayHereHash('https://api.test', 'token', { order_id: 'o1', amount: 100 }),
    ).rejects.toMatchObject({
      message: ERROR.checkout.paymentApiUnreachable,
      code: 'unreachable',
    });
  });
});
