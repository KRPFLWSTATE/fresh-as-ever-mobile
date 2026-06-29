/** merchant/orders?view= parity (web redirects late-pickups etc. here). */

export type MerchantOrdersView =
  | 'all'
  | 'verification'
  | 'review-pending'
  | 'late-pickups'
  | 'live-monitor';

export const MERCHANT_ORDERS_VIEWS: MerchantOrdersView[] = [
  'all',
  'verification',
  'live-monitor',
  'review-pending',
  'late-pickups',
];

export function parseMerchantOrdersView(raw: unknown): MerchantOrdersView {
  const v = String(raw ?? 'all').toLowerCase();
  return MERCHANT_ORDERS_VIEWS.includes(v as MerchantOrdersView)
    ? (v as MerchantOrdersView)
    : 'all';
}
