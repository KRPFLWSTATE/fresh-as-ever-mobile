import { calcItemSavingsPercent } from '@/lib/shelfDisplay';
import { resolveShelfItemCategory } from '@/lib/shelfBrowse';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import {
  canPublishClearanceShelves,
  canPublishRescueBags,
} from '@/lib/outletListingMode';
import { parseOutletCoords } from '@/lib/parseOutletCoords';
import type { getSupabase } from '@/lib/supabase';

export type DiscoverFeedItem =
      | {
      kind: 'bag';
      id: string;
      payload: Record<string, unknown>;
      pickup_start?: string | null;
      outlet_lat?: number | null;
      outlet_lng?: number | null;
      outlet_category?: string | null;
      [key: string]: unknown;
    }
  | {
      kind: 'shelf';
      id: string;
      itemCount: number;
      thumbnails: string[];
      minPrice: number;
      pickup_start?: string | null;
      pickup_end?: string | null;
      outlet_id?: string;
      outlet_name?: string;
      outlet_lat?: number | null;
      outlet_lng?: number | null;
      category?: string | null;
      merchant_name?: string | null;
      trust_score?: number | null;
      previewItemNames?: string[];
      shelfCategories?: string[];
      savingsPercentMin?: number;
      savingsPercentMax?: number;
      payload: Record<string, unknown>;
    };

export function mapShelfToFeedItem(shelf: Record<string, unknown>): DiscoverFeedItem {
  const items = (shelf.items ?? shelf.clearance_shelf_items ?? []) as Record<
    string,
    unknown
  >[];
  const liveItems = items.filter(
    (i) => i.status === 'live' && Number(i.quantity_remaining ?? 0) > 0,
  );
  const thumbs = liveItems
    .slice(0, 3)
    .map((i) => i.image_url_snapshot as string | undefined)
    .filter(Boolean) as string[];
  const minPrice = liveItems.reduce((min, i) => {
    const p = Number(i.rescue_price ?? Infinity);
    return Math.min(min, p);
  }, Infinity);
  const previewItemNames = liveItems
    .slice(0, 3)
    .map((i) => String(i.name_snapshot ?? '').trim())
    .filter((n) => n.length > 0);
  const shelfCategories = [
    ...new Set(
      liveItems.map((i) => resolveShelfItemCategory(i)).filter((c) => c !== 'Other'),
    ),
  ];
  const savingsPercents = liveItems
    .map((i) =>
      calcItemSavingsPercent(
        i.retail_price as string | number | null | undefined,
        i.rescue_price as string | number | null | undefined,
      ),
    )
    .filter((p) => p > 0);
  const savingsPercentMin =
    savingsPercents.length > 0 ? Math.min(...savingsPercents) : undefined;
  const savingsPercentMax =
    savingsPercents.length > 0 ? Math.max(...savingsPercents) : undefined;
  const outlet = (shelf.outlet ?? {}) as Record<string, unknown>;
  const merchant = outlet.merchant as Record<string, unknown> | undefined;
  // Handles GeoJSON, WKT, and the raw EWKB hex PostgREST actually returns.
  const coords = parseOutletCoords(outlet.location);
  return {
    kind: 'shelf',
    id: String(shelf.id),
    itemCount: liveItems.length,
    thumbnails: thumbs,
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    pickup_start: shelf.pickup_start as string | undefined,
    pickup_end: shelf.pickup_end as string | undefined,
    outlet_id: shelf.outlet_id as string | undefined,
    outlet_name: (outlet.name ?? outlet.business_name) as string | undefined,
    outlet_lat: coords?.lat ?? null,
    outlet_lng: coords?.lng ?? null,
    category: outlet.category as string | undefined,
    merchant_name: merchant?.business_name as string | undefined,
    trust_score: outlet.trust_score as number | undefined,
    previewItemNames,
    shelfCategories,
    savingsPercentMin,
    savingsPercentMax,
    payload: shelf,
  };
}

export function mapBagToFeedItem(bag: Record<string, unknown>): DiscoverFeedItem {
  const outlet = bag.outlet as Record<string, unknown> | undefined;
  return {
    kind: 'bag',
    id: String(bag.id),
    payload: bag,
    outlet_category:
      bag.outlet_category != null
        ? String(bag.outlet_category)
        : outlet?.category != null
          ? String(outlet.category)
          : null,
    ...bag,
  } as DiscoverFeedItem;
}

export async function fetchPublishedShelves(
  supabase: ReturnType<typeof getSupabase>,
): Promise<Record<string, unknown>[]> {
  if (!isClearanceShelvesEnabled()) return [];
  const { data, error } = await supabase
    .from('clearance_shelves')
    .select(
      `
      id,
      outlet_id,
      pickup_start,
      pickup_end,
      status,
      items:clearance_shelf_items (
        id, status, quantity_remaining, rescue_price, retail_price,
        name_snapshot, brand_snapshot, product_id, category_snapshot,
        image_url_snapshot, allergens_snapshot, is_halal,
        product:product_catalog (category)
      ),
      outlet:outlets (
        id, name, category, location, is_active,
        trust_score, average_rating, total_reviews,
        merchant:merchants (business_name, status)
      )
    `,
    )
    .eq('status', 'published')
    .gt('pickup_end', new Date().toISOString());
  if (error) {
    console.warn('fetchPublishedShelves', error.message);
    return [];
  }
  return (data ?? []).filter((s) => {
    const rawOutlet = s.outlet as unknown;
    const outlet = (
      Array.isArray(rawOutlet) ? rawOutlet[0] : rawOutlet
    ) as Record<string, unknown> | undefined;
    if (!isOutletDiscoverVisible(outlet)) return false;
    return ((s.items as unknown[]) ?? []).some(
      (i) =>
        (i as Record<string, unknown>).status === 'live' &&
        Number((i as Record<string, unknown>).quantity_remaining) > 0,
    );
  }) as Record<string, unknown>[];
}

/** Hide listings from paused outlets or merchants that ops suspended/rejected. */
export function isOutletDiscoverVisible(
  outlet: Record<string, unknown> | undefined,
): boolean {
  if (!outlet) return false;
  if (outlet.is_active === false) return false;
  const merchant = outlet.merchant as Record<string, unknown> | undefined;
  if (!merchant?.status) return false;
  return String(merchant.status) === 'approved';
}

export function filterDiscoverFeedByMerchantStatus(
  items: DiscoverFeedItem[],
): DiscoverFeedItem[] {
  return items.filter((item) => {
    const payload = item.payload as Record<string, unknown>;
    const outlet = payload.outlet as Record<string, unknown> | undefined;
    if (!outlet) {
      // `nearby_bags` RPC rows are flat (no nested outlet join) but are already
      // vetted server-side. Dropping them here hid every bag while shelves kept
      // their nested `outlet:outlets(...)` join from `fetchPublishedShelves`.
      return item.kind === 'bag';
    }
    return isOutletDiscoverVisible(outlet);
  });
}

export function mergeDiscoverFeed(
  bags: Record<string, unknown>[],
  shelves: Record<string, unknown>[],
): DiscoverFeedItem[] {
  const bagItems = (bags ?? []).map(mapBagToFeedItem);
  const shelfItems = (shelves ?? []).map(mapShelfToFeedItem);
  return filterDiscoverFeedByMerchantStatus(
    filterDiscoverFeedByListingMode([...bagItems, ...shelfItems]),
  ).sort((a, b) => {
    const aStart = a.pickup_start ?? (a.kind === 'bag' ? a.payload?.pickup_start : '') ?? '';
    const bStart = b.pickup_start ?? (b.kind === 'bag' ? b.payload?.pickup_start : '') ?? '';
    return String(aStart).localeCompare(String(bStart));
  });
}

function feedItemOutletCategory(item: DiscoverFeedItem): string {
  if (item.kind === 'shelf') {
    return String(item.category ?? '');
  }
  const payload = item.payload as Record<string, unknown>;
  const outlet = payload.outlet as Record<string, unknown> | undefined;
  return String(
    item.outlet_category ??
      payload.outlet_category ??
      outlet?.category ??
      '',
  );
}

/** Hide bags from supermarket-only outlets and shelves from bag-only outlets. */
export function filterDiscoverFeedByListingMode(
  items: DiscoverFeedItem[],
): DiscoverFeedItem[] {
  const clearanceOn = isClearanceShelvesEnabled();
  return items.filter((item) => {
    const outletCategory = feedItemOutletCategory(item);
    if (item.kind === 'shelf') {
      return clearanceOn && canPublishClearanceShelves(outletCategory);
    }
    return canPublishRescueBags(outletCategory);
  });
}
