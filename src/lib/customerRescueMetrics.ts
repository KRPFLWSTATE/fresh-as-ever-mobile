import { isCollectedOrder } from '@/lib/merchantAnalytics';
import { normalizeOrderStatus } from '@/lib/orderStatus';

/** Terminal failures — excluded from rescue impact and payment history. */
export const CUSTOMER_RESCUE_EXCLUDED_STATUSES = new Set([
  'cancelled',
  'refunded',
  'no_show',
  'disputed',
]);

/** Count toward profile / impact rescue totals after handover or dispute resolution. */
export function isCustomerRescueCompleted(
  orderStatus: string | null | undefined,
): boolean {
  const normalized = normalizeOrderStatus(orderStatus);
  if (isCollectedOrder(normalized)) return true;
  return normalized === 'resolved';
}

/** Rows shown under Profile → Payments → Recent Transactions. */
export function isCustomerOrderHistoryVisible(
  orderStatus: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  const normalized = normalizeOrderStatus(orderStatus);
  if (CUSTOMER_RESCUE_EXCLUDED_STATUSES.has(normalized)) return false;
  const paid = String(paymentStatus ?? '')
    .trim()
    .toLowerCase();
  return paid === 'paid' || isCustomerRescueCompleted(orderStatus);
}

/** Archived orders list — completed rescues only (no cancelled clutter). */
export function isCustomerArchivedOrderVisible(
  orderStatus: string | null | undefined,
): boolean {
  const normalized = normalizeOrderStatus(orderStatus);
  if (CUSTOMER_RESCUE_EXCLUDED_STATUSES.has(normalized)) return false;
  return isCustomerRescueCompleted(orderStatus);
}

export const CUSTOMER_IMPACT_ORDER_STATUSES = [
  'collected',
  'completed',
  'resolved',
] as const;
