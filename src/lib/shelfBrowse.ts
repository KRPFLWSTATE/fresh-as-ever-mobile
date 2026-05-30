export type ShelfSortKey = 'default' | 'price_asc' | 'price_desc' | 'name' | 'savings';

export type ShelfBrowseItem = Record<string, unknown>;

export function filterShelfItems(
  items: ShelfBrowseItem[],
  query: string,
): ShelfBrowseItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const name = String(item.name_snapshot ?? '').toLowerCase();
    const brand = String(item.brand_snapshot ?? '').toLowerCase();
    const barcode = String(item.barcode ?? '').toLowerCase();
    return name.includes(q) || brand.includes(q) || barcode.includes(q);
  });
}

export function sortShelfItems(
  items: ShelfBrowseItem[],
  sortKey: ShelfSortKey,
): ShelfBrowseItem[] {
  const copy = [...items];
  if (sortKey === 'default') {
    return copy.sort(
      (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
    );
  }
  if (sortKey === 'name') {
    return copy.sort((a, b) =>
      String(a.name_snapshot ?? '').localeCompare(String(b.name_snapshot ?? '')),
    );
  }
  if (sortKey === 'price_asc') {
    return copy.sort(
      (a, b) => Number(a.rescue_price ?? 0) - Number(b.rescue_price ?? 0),
    );
  }
  if (sortKey === 'price_desc') {
    return copy.sort(
      (a, b) => Number(b.rescue_price ?? 0) - Number(a.rescue_price ?? 0),
    );
  }
  if (sortKey === 'savings') {
    return copy.sort((a, b) => savingsPct(b) - savingsPct(a));
  }
  return copy;
}

function savingsPct(item: ShelfBrowseItem): number {
  const retail = Number(item.retail_price ?? 0);
  const rescue = Number(item.rescue_price ?? 0);
  if (retail <= 0 || rescue >= retail) return 0;
  return ((retail - rescue) / retail) * 100;
}

export function groupShelfItemsByCategory(
  items: ShelfBrowseItem[],
): { category: string; items: ShelfBrowseItem[] }[] {
  const map = new Map<string, ShelfBrowseItem[]>();
  for (const item of items) {
    const cat =
      typeof item.catalog_category === 'string' && item.catalog_category.trim()
        ? item.catalog_category.trim()
        : 'Other';
    const bucket = map.get(cat) ?? [];
    bucket.push(item);
    map.set(cat, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, groupItems]) => ({ category, items: groupItems }));
}

export function applyBulkDiscountToItems<T extends { retail_price?: number | null; rescue_price: number }>(
  items: T[],
  percentOff: number,
): T[] {
  const pct = Math.min(99, Math.max(1, Math.round(percentOff)));
  const factor = 1 - pct / 100;
  return items.map((item) => {
    const retail = item.retail_price;
    if (retail == null || !Number.isFinite(retail) || retail <= 0) {
      return item;
    }
    const rescue = Math.max(1, Math.round(retail * factor));
    return { ...item, rescue_price: rescue };
  });
}

export type PublishChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
};

export function buildPublishChecklist(args: {
  pickupStart: string;
  pickupEnd: string;
  itemCount: number;
  itemsMissingRetail: number;
  outletHalalCertified: boolean;
  nonHalalCount: number;
}): PublishChecklistItem[] {
  const pickupOk =
    Boolean(args.pickupStart && args.pickupEnd) &&
    new Date(args.pickupStart).getTime() < new Date(args.pickupEnd).getTime();
  return [
    { id: 'pickup', label: 'Pickup window set', ok: pickupOk },
    { id: 'items', label: 'At least one item on shelf', ok: args.itemCount > 0 },
    {
      id: 'retail',
      label: 'Retail prices set (for savings display)',
      ok: args.itemsMissingRetail === 0,
    },
    {
      id: 'halal',
      label: args.outletHalalCertified
        ? 'Halal items reviewed'
        : 'Halal review (not required)',
      ok: !args.outletHalalCertified || args.nonHalalCount === 0,
    },
  ];
}
