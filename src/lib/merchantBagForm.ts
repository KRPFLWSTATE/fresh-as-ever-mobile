export type MerchantBagFormState = {
  title: string;
  description: string;
  category: string;
  image_url: string;
  retail_value_estimate: string;
  rescue_price: string;
  quantity_remaining: string;
  pickup_start: string;
  pickup_end: string;
  selectedAllergens: string[];
  isHalal: boolean;
};

export type MerchantBagFormValues = {
  title: string;
  rescuePrice: string;
  quantity: string;
  pickupStart?: Date;
  pickupEnd?: Date;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local `YYYY-MM-DDTHH:mm` for datetime inputs (no timezone suffix). */
export function isoLocalRounded(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toLocalDateTime(iso: string): string {
  if (!iso.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return isoLocalRounded(d);
}

export function defaultCreateForm(): MerchantBagFormState {
  const now = new Date();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: '',
    description: '',
    category: 'bakery',
    image_url: '',
    retail_value_estimate: '',
    rescue_price: '',
    quantity_remaining: '1',
    pickup_start: isoLocalRounded(now),
    pickup_end: isoLocalRounded(end),
    selectedAllergens: [],
    isHalal: false,
  };
}

export function buildRescueBagInsertPayload(
  outletId: string,
  values: MerchantBagFormValues,
): Record<string, unknown> | null {
  const title = values.title.trim();
  if (!title) return null;
  const price = Number(values.rescuePrice.replace(/[^\d.]/g, ''));
  const qty = Math.max(1, Number(values.quantity.replace(/[^\d.]/g, '')) || 1);
  if (!Number.isFinite(price) || price <= 0) return null;

  const start = values.pickupStart ?? new Date();
  const end =
    values.pickupEnd ?? new Date(start.getTime() + 2 * 60 * 60 * 1000);

  return {
    outlet_id: outletId,
    title,
    rescue_price: price,
    quantity_total: qty,
    quantity_remaining: qty,
    pickup_start: start.toISOString(),
    pickup_end: end.toISOString(),
    status: 'draft',
  };
}
