import { ERROR } from '@/lib/messages/errors';

function lower(msg: unknown): string {
  return String(msg ?? '').toLowerCase();
}

export function mapHandoverError(
  message: unknown,
  fallback: string = ERROR.handover.failed,
): string {
  const m = lower(message);
  if (m.includes('grace') || m.includes('30 minute')) return ERROR.handover.grace;
  if (m.includes('order_not_ready') || m.includes('not ready') || m.includes('not_ready')) {
    return ERROR.handover.notReady;
  }
  if (m.includes('code_mismatch') || m.includes('mismatch')) return ERROR.handover.codeMismatch;
  if (m.includes('code_length') || m.includes('6 character')) return ERROR.handover.codeLength;
  return fallback;
}

export function mapArrivalError(
  message: unknown,
  fallback: string = ERROR.arrival.failed,
): string {
  const m = lower(message);
  if (m.includes('not_eligible') || m.includes('window') || m.includes('15 minute')) {
    return ERROR.arrival.notEligible;
  }
  if (m.includes('payment')) return ERROR.arrival.paymentFirst;
  return fallback;
}

export function mapOnMyWayError(
  message: unknown,
  fallback: string = ERROR.onMyWay.failed,
): string {
  const m = lower(message);
  if (m.includes('on_my_way_window_not_open') || m.includes('2 hour') || m.includes('window')) {
    return ERROR.onMyWay.notEligible;
  }
  if (m.includes('payment')) return ERROR.onMyWay.paymentFirst;
  if (m.includes('pickup_window_closed')) return ERROR.onMyWay.windowClosed;
  return fallback;
}

export function mapOnMyWayError(
  message: unknown,
  fallback: string = ERROR.onMyWay.failed,
): string {
  const m = lower(message);
  if (m.includes('not_eligible') || m.includes('window') || m.includes('2 hour')) {
    return ERROR.onMyWay.notEligible;
  }
  if (m.includes('payment')) return ERROR.onMyWay.paymentFirst;
  return fallback;
}

export function mapCheckoutError(
  message: unknown,
  fallback: string = ERROR.checkout.reserveFailed,
  listingKind: 'bag' | 'shelf' = 'bag',
): string {
  const m = lower(message);
  if (m.includes('sold out') || m.includes('quantity') || m.includes('clearance_item_sold_out')) {
    return listingKind === 'shelf' ? ERROR.checkout.shelfSoldOut : ERROR.checkout.soldOut;
  }
  if (m.includes('network') || m.includes('fetch')) return ERROR.common.network;
  return fallback;
}
