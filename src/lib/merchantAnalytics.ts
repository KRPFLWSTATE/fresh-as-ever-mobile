export const ANALYTICS_WINDOW_OPTIONS = [
  { key: 7, label: 'Last 7 days' },
  { key: 30, label: 'Last 30 days' },
  { key: 90, label: 'Last 90 days' },
] as const;

export type AnalyticsWindowKey = (typeof ANALYTICS_WINDOW_OPTIONS)[number]['key'];

export type HourBucket = { hour: number; count: number };

export type TopSellingBag = {
  bagId: string;
  title: string;
  units: number;
  revenue: number;
};

const COLLECTED_STATUSES = new Set(['collected', 'completed']);

export function cutoffIsoForWindow(days: AnalyticsWindowKey): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function aggregateHourBuckets(
  rows: { created_at?: string | null }[],
): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of rows) {
    const ts =
      typeof row.created_at === 'string' ? new Date(row.created_at) : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;
    buckets[ts.getHours()].count += 1;
  }
  return buckets;
}

export function countDistinctCustomers(
  rows: { customer_id?: string | null }[],
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.customer_id != null ? String(row.customer_id) : '';
    if (id) ids.add(id);
  }
  return ids.size;
}

export function sumRevenue(
  rows: { total?: number | string | null }[],
): number {
  return rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
}

export function sumSurplusRecovered(
  rows: {
    quantity?: number | null;
    bag?: { retail_value_estimate?: number | string | null } | null;
  }[],
): number {
  let total = 0;
  for (const row of rows) {
    const retail = Number(row.bag?.retail_value_estimate ?? 0);
    if (!Number.isFinite(retail) || retail <= 0) continue;
    const qty = Math.max(1, Number(row.quantity ?? 1) || 1);
    total += retail * qty;
  }
  return Math.round(total);
}

export function estimateWasteKg(
  orders: { bag_id?: string | null; quantity?: number | null }[],
  bagWeightById: Map<string, number>,
): number {
  let kg = 0;
  for (const o of orders) {
    const bagId = o.bag_id != null ? String(o.bag_id) : '';
    const qty = Number(o.quantity ?? 1) || 1;
    const perBag = bagWeightById.get(bagId) ?? 1;
    kg += perBag * qty;
  }
  return Math.round(kg * 10) / 10;
}

/** Proxy kg from retail_value_estimate (LKR): ~1 kg per Rs. 800 retail value, min 0.5 kg per bag. */
export function retailToKgProxy(retail: number | null | undefined): number {
  const r = Number(retail ?? 0);
  if (!Number.isFinite(r) || r <= 0) return 1;
  return Math.max(0.5, Math.round((r / 800) * 10) / 10);
}

export function aggregateTopBags(
  rows: {
    bag_id?: string | null;
    total?: number | string | null;
    quantity?: number | null;
    bag?: { title?: string | null } | null;
  }[],
  limit = 5,
): TopSellingBag[] {
  const map = new Map<string, TopSellingBag>();
  for (const row of rows) {
    const bagId = row.bag_id != null ? String(row.bag_id) : '';
    if (!bagId) continue;
    const qty = Number(row.quantity ?? 1) || 1;
    const rev = Number(row.total ?? 0);
    const title =
      (row.bag as { title?: string } | null | undefined)?.title?.trim() ||
      'Rescue bag';
    const cur = map.get(bagId) ?? {
      bagId,
      title,
      units: 0,
      revenue: 0,
    };
    cur.units += qty;
    cur.revenue += rev;
    map.set(bagId, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit);
}

export function isCollectedOrder(orderStatus: string | null | undefined): boolean {
  return COLLECTED_STATUSES.has(String(orderStatus ?? '').toLowerCase());
}

export function formatLkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

export function peakHourLabel(buckets: HourBucket[]): string {
  const peak = buckets.reduce(
    (best, b) => (b.count > best.count ? b : best),
    buckets[0] ?? { hour: 0, count: 0 },
  );
  const h = peak.hour;
  const end = (h + 1) % 24;
  const fmt = (x: number) =>
    `${x === 0 ? 12 : x > 12 ? x - 12 : x}${x >= 12 && x < 24 ? 'pm' : 'am'}`;
  return `${fmt(h)}–${fmt(end)}`;
}
