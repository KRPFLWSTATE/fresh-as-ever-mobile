/** Mirrors `fresh-as-ever/src/lib/utils` order status helpers for merchant flows. */

import { NO_SHOW_GRACE_MS } from '../domain/pickupWindow';

const ORDER_STATUS_ALIASES: Record<string, string> = {
  awaiting_pickup: 'ready_for_pickup',
  confirmed: 'paid',
  preparing: 'paid',
};

export const ACTIVE_ORDER_STATUSES = ['reserved', 'paid', 'ready_for_pickup'] as const;

export const ORDER_ID_UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrderIdUuidShape(value: string): boolean {
  return ORDER_ID_UUID_SHAPE.test(String(value || '').trim());
}

export function normalizeOrderStatus(status: string | null | undefined): string {
  const value = String(status ?? '')
    .trim()
    .toLowerCase();
  return ORDER_STATUS_ALIASES[value] || value || 'reserved';
}

const NO_SHOW_MERCHANT_NORMALIZED = new Set(['paid', 'ready_for_pickup']);

export function isPickupNoShowGraceElapsed(pickupEndIso: string | null | undefined): boolean {
  if (pickupEndIso == null) return false;
  const end = new Date(pickupEndIso).getTime();
  if (Number.isNaN(end)) return false;
  return Date.now() >= end + NO_SHOW_GRACE_MS;
}

export function isOrderEligibleForMerchantNoShow(
  normalizedStatus: string,
  pickupEndIso: string | null | undefined,
): boolean {
  const s = normalizeOrderStatus(normalizedStatus);
  return NO_SHOW_MERCHANT_NORMALIZED.has(s) && isPickupNoShowGraceElapsed(pickupEndIso);
}
