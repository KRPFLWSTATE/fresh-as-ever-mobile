export type ShelfSortKey = 'default' | 'price_asc' | 'price_desc' | 'name' | 'savings';

export type ShelfBrowseItem = Record<string, unknown>;

const DEMO_NAME_CATEGORY_RULES: ReadonlyArray<[RegExp, string]> = [
  [/bread|pastry|croissant|baguette|roll/i, 'Bakery'],
  [/milk|yogurt|yoghurt|egg|dairy|cheese|butter/i, 'Dairy'],
  [/banana|produce|fruit|vegetable|apple|tomato|salad/i, 'Produce'],
];

/** Resolve shelf item category for browse grouping and discover previews. */
export function resolveShelfItemCategory(item: ShelfBrowseItem): string {
  const snapshot = item.category_snapshot;
  if (typeof snapshot === 'string' && snapshot.trim()) {
    return snapshot.trim();
  }
  const catalog = item.catalog_category;
  if (typeof catalog === 'string' && catalog.trim()) {
    return catalog.trim();
  }
  const product = item.product as { category?: string | null } | undefined;
  if (typeof product?.category === 'string' && product.category.trim()) {
    return product.category.trim();
  }
  const name = String(item.name_snapshot ?? '');
  for (const [pattern, category] of DEMO_NAME_CATEGORY_RULES) {
    if (pattern.test(name)) return category;
  }
  return 'Other';
}

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
    const cat = resolveShelfItemCategory(item);
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

export type PublishChecklistGate = {
  canConfirmPublish: boolean;
  halalOnlyBlock: boolean;
  failedLabels: string[];
  blockMessage: string | null;
};

/** Whether Confirm publish is allowed and what blocking copy to show in the checklist modal. */
export function getPublishChecklistGate(
  checklist: PublishChecklistItem[],
): PublishChecklistGate {
  const failed = checklist.filter((item) => !item.ok);
  if (failed.length === 0) {
    return {
      canConfirmPublish: true,
      halalOnlyBlock: false,
      failedLabels: [],
      blockMessage: null,
    };
  }
  const halalOnlyBlock = failed.length === 1 && failed[0]?.id === 'halal';
  if (halalOnlyBlock) {
    return {
      canConfirmPublish: false,
      halalOnlyBlock: true,
      failedLabels: failed.map((item) => item.label),
      blockMessage:
        'Some items are not marked halal. Edit items to mark halal, or use Publish anyway to continue with a customer warning.',
    };
  }
  return {
    canConfirmPublish: false,
    halalOnlyBlock: false,
    failedLabels: failed.map((item) => item.label),
    blockMessage: `Complete before publishing: ${failed.map((item) => item.label).join(', ')}.`,
  };
}
