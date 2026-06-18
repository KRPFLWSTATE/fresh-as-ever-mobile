export type SeasonalOccasionKind =
  | 'none'
  | 'avurudu'
  | 'vesak_dana'
  | 'eid_special'
  | 'christmas_bake';

export type SeasonalOccasionWindow = {
  occasion: SeasonalOccasionKind;
  starts_on: string;
  ends_on: string;
  label: string;
};

export const TAGGABLE_SEASONAL_OCCASIONS: Exclude<SeasonalOccasionKind, 'none'>[] = [
  'avurudu',
  'vesak_dana',
  'eid_special',
  'christmas_bake',
];

const DEFAULT_LABELS: Record<Exclude<SeasonalOccasionKind, 'none'>, string> = {
  avurudu: 'Avurudu',
  vesak_dana: 'Vesak Dana',
  eid_special: 'Eid Special',
  christmas_bake: 'Christmas Bake',
};

export function parseSeasonalOccasionKind(
  value: unknown,
): SeasonalOccasionKind {
  const raw = String(value ?? 'none').trim();
  if (
    raw === 'avurudu' ||
    raw === 'vesak_dana' ||
    raw === 'eid_special' ||
    raw === 'christmas_bake'
  ) {
    return raw;
  }
  return 'none';
}

export function toSeasonDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateInSeasonWindow(
  date: Date,
  window: SeasonalOccasionWindow,
): boolean {
  const key = toSeasonDateKey(date);
  return key >= window.starts_on && key <= window.ends_on;
}

export function getActiveSeasonalWindows(
  windows: SeasonalOccasionWindow[],
  date: Date = new Date(),
): SeasonalOccasionWindow[] {
  return windows.filter(
    (w) => w.occasion !== 'none' && isDateInSeasonWindow(date, w),
  );
}

export function isOccasionWindowActive(
  occasion: SeasonalOccasionKind,
  windows: SeasonalOccasionWindow[],
  date: Date = new Date(),
): boolean {
  if (occasion === 'none') return false;
  const row = windows.find((w) => w.occasion === occasion);
  if (!row) return false;
  return isDateInSeasonWindow(date, row);
}

export function getOccasionLabel(
  occasion: SeasonalOccasionKind,
  windows?: SeasonalOccasionWindow[],
): string | null {
  if (occasion === 'none') return null;
  const fromWindow = windows?.find((w) => w.occasion === occasion)?.label?.trim();
  if (fromWindow) return fromWindow;
  return DEFAULT_LABELS[occasion] ?? null;
}

export function shouldShowOccasionBadge(
  occasionKind: SeasonalOccasionKind | null | undefined,
  windows: SeasonalOccasionWindow[],
  featureEnabled: boolean,
  date: Date = new Date(),
): boolean {
  if (!featureEnabled) return false;
  const kind = parseSeasonalOccasionKind(occasionKind);
  if (kind === 'none') return false;
  return isOccasionWindowActive(kind, windows, date);
}

export function listingMatchesOccasionFilter(
  occasionKind: SeasonalOccasionKind | null | undefined,
  filterOccasion: SeasonalOccasionKind | 'all',
): boolean {
  if (filterOccasion === 'all') return true;
  return parseSeasonalOccasionKind(occasionKind) === filterOccasion;
}
