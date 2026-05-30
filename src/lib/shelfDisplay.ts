/** Shared shelf item display helpers (mobile + web parity). */

export type ShelfLineInput = {
  retail_price?: number | string | null;
  rescue_price?: number | string | null;
  quantity?: number | string | null;
};

export type UnitLabelInput = {
  name?: string | null;
  weight_grams?: number | string | null;
};

const LOW_STOCK_THRESHOLD = 3;

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Percent saved on a single item line (0 when retail missing or invalid). */
export function calcItemSavingsPercent(
  retailPrice: number | string | null | undefined,
  rescuePrice: number | string | null | undefined,
): number {
  const retail = toNumber(retailPrice);
  const rescue = toNumber(rescuePrice);
  if (retail == null || retail <= 0 || rescue == null) return 0;
  const pct = Math.round(((retail - rescue) / retail) * 100);
  return Math.max(0, pct);
}

/** e.g. "Save 42%" or null when no savings to show. */
export function formatItemSavings(
  retailPrice: number | string | null | undefined,
  rescuePrice: number | string | null | undefined,
): string | null {
  const pct = calcItemSavingsPercent(retailPrice, rescuePrice);
  if (pct <= 0) return null;
  return `Save ${pct}%`;
}

/** Append weight when present, e.g. "Full cream milk · 500g". */
export function formatUnitLabel(input: UnitLabelInput): string {
  const name = String(input.name ?? '').trim();
  const grams = toNumber(input.weight_grams);
  if (grams != null && grams > 0) {
    const weight =
      grams >= 1000 ? `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)}kg` : `${Math.round(grams)}g`;
    return name ? `${name} · ${weight}` : weight;
  }
  return name;
}

/** e.g. "Only 2 left" when stock is low but available. */
export function formatLowStock(quantityRemaining: number | string | null | undefined): string | null {
  const qty = toNumber(quantityRemaining);
  if (qty == null || qty <= 0 || qty > LOW_STOCK_THRESHOLD) return null;
  return qty === 1 ? 'Only 1 left' : `Only ${qty} left`;
}

/** Sum savings when lines carry id + qty map (shelf basket). */
export function sumRetailSavingsForItems(
  items: ({ id?: string; retail_price?: number | string | null; rescue_price?: number | string | null } & ShelfLineInput)[],
  quantities: Record<string, number>,
): number {
  return items.reduce((sum, item) => {
    const id = item.id != null ? String(item.id) : '';
    const qty = id ? Number(quantities[id] ?? 0) : toNumber(item.quantity) ?? 0;
    if (qty <= 0) return sum;
    const retail = toNumber(item.retail_price);
    const rescue = toNumber(item.rescue_price) ?? 0;
    if (retail == null || retail <= rescue) return sum;
    return sum + (retail - rescue) * qty;
  }, 0);
}

/** Alias used by shelf/checkout UI (id-keyed qty map). */
export const sumRetailSavings = sumRetailSavingsForItems;

export function formatPickupWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): { window: string; day: string } {
  if (!startIso || !endIso) return { window: '—', day: '' };
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { window: '—', day: '' };
  }
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const window = `${start.toLocaleTimeString(undefined, tf)} – ${end.toLocaleTimeString(undefined, tf)}`;
  const today = new Date();
  const day =
    start.toDateString() === today.toDateString()
      ? 'Today'
      : start.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
  return { window, day };
}

/** Optional best-before date on shelf item rows, e.g. "Best before 2 Jun". */
export function formatBestBefore(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return `Best before ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/** Customer-facing pickup countdown, e.g. "Pickup by 6:30 PM". */
export function formatPickupByLabel(endIso: string | null | undefined): string | null {
  if (!endIso) return null;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return null;
  const tf: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `Pickup by ${end.toLocaleTimeString(undefined, tf)}`;
}
