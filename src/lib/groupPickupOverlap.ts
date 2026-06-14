export type PickupWindowRow = {
  pickup_start?: string | null;
  pickup_end?: string | null;
};

function parseMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

export function normalizePickupWindow(row: PickupWindowRow): {
  start: number;
  end: number;
} | null {
  const start = parseMs(row.pickup_start);
  const end = parseMs(row.pickup_end);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

/** True when every bag shares at least one common pickup instant. */
export function haveCommonPickupOverlap(windows: PickupWindowRow[]): boolean {
  const parsed = windows
    .map(normalizePickupWindow)
    .filter((w): w is { start: number; end: number } => w != null);
  if (parsed.length <= 1) return true;
  if (parsed.length !== windows.length) return false;
  const start = Math.max(...parsed.map((w) => w.start));
  const end = Math.min(...parsed.map((w) => w.end));
  return start < end;
}

export function describePickupOverlapIssue(windows: PickupWindowRow[]): string | null {
  if (haveCommonPickupOverlap(windows)) return null;
  return 'These bags have different pickup windows. Choose bags you can collect in one trip.';
}
