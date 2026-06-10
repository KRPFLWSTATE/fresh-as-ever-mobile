import { isoLocalRounded, toLocalDateTime } from '@/lib/merchantBagForm';

export type ShelfItemDraft = {
  id?: string;
  tempId?: string;
  product_id?: string | null;
  barcode?: string | null;
  name_snapshot: string;
  brand_snapshot?: string | null;
  image_url_snapshot?: string | null;
  allergens_snapshot: string[];
  is_halal?: boolean | null;
  retail_price?: number | null;
  rescue_price: number;
  quantity_total: number;
  quantity_remaining: number;
  sort_order?: number;
  catalog_category?: string | null;
  catalog_weight_grams?: number | null;
  catalog_ingredients?: string | null;
  best_before?: string | null;
  /** Local editor flag; persisted as clearance_shelf_items.status on save. */
  item_status?: 'live' | 'sold_out';
};

export type ShelfEditorForm = {
  pickup_start: string;
  pickup_end: string;
  notes: string;
  title: string;
  description: string;
  cover_image_url: string;
  items: ShelfItemDraft[];
};

/** Optional unit suffix stored in name_snapshot via " · unit" when no weight. */
export const SHELF_UNIT_OPTIONS = ['each', 'pack', 'kg', 'g', 'L', 'ml'] as const;
export type ShelfUnitOption = (typeof SHELF_UNIT_OPTIONS)[number];

export function appendUnitToName(name: string, unit: ShelfUnitOption | ''): string {
  const base = name.replace(/\s*·\s*(each|pack|kg|g|L|ml)$/i, '').trim();
  if (!unit) return base;
  return `${base} · ${unit}`;
}

export function parseUnitFromName(name: string): { baseName: string; unit: ShelfUnitOption | '' } {
  const m = name.match(/\s*·\s*(each|pack|kg|g|L|ml)$/i);
  if (!m) return { baseName: name.trim(), unit: '' };
  const unit = m[1].toLowerCase() as ShelfUnitOption;
  return { baseName: name.slice(0, m.index).trim(), unit };
}

export function newTempItemId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultShelfEditorForm(): ShelfEditorForm {
  const now = new Date();
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return {
    pickup_start: isoLocalRounded(now),
    pickup_end: isoLocalRounded(end),
    notes: '',
    title: '',
    description: '',
    cover_image_url: '',
    items: [],
  };
}

export function shelfItemsFromRow(
  items: Record<string, unknown>[] | undefined,
): ShelfItemDraft[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i.status !== 'removed')
    .map((i, idx) => ({
      id: typeof i.id === 'string' ? i.id : undefined,
      product_id: typeof i.product_id === 'string' ? i.product_id : null,
      barcode: typeof i.barcode === 'string' ? i.barcode : null,
      name_snapshot: String(i.name_snapshot ?? ''),
      brand_snapshot:
        typeof i.brand_snapshot === 'string' ? i.brand_snapshot : null,
      image_url_snapshot:
        typeof i.image_url_snapshot === 'string' ? i.image_url_snapshot : null,
      allergens_snapshot: Array.isArray(i.allergens_snapshot)
        ? (i.allergens_snapshot as string[])
        : [],
      is_halal: typeof i.is_halal === 'boolean' ? i.is_halal : null,
      retail_price:
        typeof i.retail_price === 'number'
          ? i.retail_price
          : i.retail_price != null
            ? Number(i.retail_price)
            : null,
      rescue_price: Number(i.rescue_price ?? 0),
      quantity_total: Number(i.quantity_total ?? 1),
      quantity_remaining: Number(i.quantity_remaining ?? i.quantity_total ?? 1),
      sort_order: typeof i.sort_order === 'number' ? i.sort_order : idx,
      best_before:
        typeof i.best_before === 'string' && i.best_before.trim().length > 0
          ? i.best_before.trim()
          : null,
      item_status:
        String(i.status ?? '') === 'sold_out' ||
        Number(i.quantity_remaining ?? 0) < 1
          ? 'sold_out'
          : 'live',
    }));
}

export function shelfFormFromRow(
  shelf: Record<string, unknown> | null | undefined,
): ShelfEditorForm {
  if (!shelf) return defaultShelfEditorForm();
  const items = shelfItemsFromRow(
    shelf.items as Record<string, unknown>[] | undefined,
  );
  const ps =
    typeof shelf.pickup_start === 'string'
      ? toLocalDateTime(shelf.pickup_start)
      : '';
  const pe =
    typeof shelf.pickup_end === 'string'
      ? toLocalDateTime(shelf.pickup_end)
      : '';
  const base = defaultShelfEditorForm();
  const notes =
    typeof shelf.notes === 'string' ? shelf.notes : shelf.notes != null ? String(shelf.notes) : '';
  const title =
    typeof shelf.title === 'string' ? shelf.title : shelf.title != null ? String(shelf.title) : '';
  const description =
    typeof shelf.description === 'string'
      ? shelf.description
      : shelf.description != null
        ? String(shelf.description)
        : '';
  const cover_image_url =
    typeof shelf.cover_image_url === 'string'
      ? shelf.cover_image_url
      : shelf.cover_image_url != null
        ? String(shelf.cover_image_url)
        : '';
  return {
    pickup_start: ps || base.pickup_start,
    pickup_end: pe || base.pickup_end,
    notes,
    title,
    description,
    cover_image_url,
    items,
  };
}

export function formatLkr(n: number): string {
  return `Rs. ${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-LK')}`;
}
