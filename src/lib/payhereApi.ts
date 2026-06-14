import { ERROR } from '@/lib/messages/errors';

export type PayHereHashResponse = {
  hash: string;
  merchant_id: string;
  amount: string;
  currency: string;
};

export class PayHereApiError extends Error {
  readonly code: 'timeout' | 'unreachable' | 'invalid_response' | 'api_error';

  constructor(
    message: string,
    code: 'timeout' | 'unreachable' | 'invalid_response' | 'api_error',
  ) {
    super(message);
    this.name = 'PayHereApiError';
    this.code = code;
  }
}

export const PAYHERE_HASH_TIMEOUT_MS = 20_000;

type PayHereHashPayload = {
  order_id?: string;
  group_id?: string;
  amount: number;
  currency?: string;
};

/**
 * POST /api/payhere/hash on the hosted Next.js API.
 * Uses text-first parsing so HTML error pages (e.g. nginx 405) cannot hang `res.json()`.
 */
export async function fetchPayHereHash(
  apiBaseUrl: string,
  accessToken: string,
  payload: PayHereHashPayload,
  timeoutMs: number = PAYHERE_HASH_TIMEOUT_MS,
): Promise<PayHereHashResponse> {
  const base = apiBaseUrl?.trim().replace(/\/$/, '');
  if (!base) {
    throw new PayHereApiError(ERROR.checkout.paymentApiUnreachable, 'unreachable');
  }

  const url = `${base}/api/payhere/hash`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        currency: payload.currency ?? 'LKR',
      }),
      signal: ac.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PayHereApiError(ERROR.checkout.paymentTimeout, 'timeout');
    }
    throw new PayHereApiError(ERROR.checkout.paymentApiUnreachable, 'unreachable');
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (res.status === 405 || /<html/i.test(text)) {
        throw new PayHereApiError(ERROR.checkout.paymentApiUnreachable, 'invalid_response');
      }
      throw new PayHereApiError(ERROR.checkout.paymentFailed, 'invalid_response');
    }
  }

  if (!res.ok) {
    const apiErr =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : ERROR.checkout.paymentFailed;
    throw new PayHereApiError(apiErr, 'api_error');
  }

  const hash = data.hash;
  const merchant_id = data.merchant_id;
  if (typeof hash !== 'string' || typeof merchant_id !== 'string' || !hash || !merchant_id) {
    throw new PayHereApiError(ERROR.checkout.paymentFailed, 'invalid_response');
  }

  return {
    hash,
    merchant_id,
    amount: String(data.amount ?? payload.amount.toFixed(2)),
    currency: String(data.currency ?? payload.currency ?? 'LKR'),
  };
}
