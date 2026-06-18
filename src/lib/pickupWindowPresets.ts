import {
  isApproachingWithin2h,
  isPickupWindowOpen,
  parsePickupMs,
} from '@/domain/pickupWindow';
import { isoLocalRounded } from '@/lib/merchantBagForm';

export const COLOMBO_TZ = 'Asia/Colombo';

export type PickupWindowKind =
  | 'custom'
  | 'morning_bake'
  | 'lunch'
  | 'evening'
  | 'immediately_2h'
  | 'now_4h';

export type PickupBrowseState = 'open_now' | 'opening_soon' | 'closed';

export const NAMED_PRESET_KINDS: PickupWindowKind[] = [
  'morning_bake',
  'lunch',
  'evening',
];

type PresetWindow = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

const PRESET_WINDOWS: Record<
  'morning_bake' | 'lunch' | 'evening',
  PresetWindow
> = {
  morning_bake: { startHour: 5, startMinute: 30, endHour: 9, endMinute: 30 },
  lunch: { startHour: 11, startMinute: 30, endHour: 14, endMinute: 30 },
  evening: { startHour: 17, startMinute: 0, endHour: 21, endMinute: 0 },
};

type ColomboParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function colomboParts(at: Date): ColomboParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(at)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function colomboOffsetMs(at: Date): number {
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const colombo = new Date(at.toLocaleString('en-US', { timeZone: COLOMBO_TZ }));
  return colombo.getTime() - utc.getTime();
}

/** UTC instant for a Colombo-local wall-clock time on a given calendar day. */
export function colomboLocalToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offset = colomboOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offset);
}

function nextPresetOccurrence(
  kind: 'morning_bake' | 'lunch' | 'evening',
  now: Date,
): { start: Date; end: Date } {
  const window = PRESET_WINDOWS[kind];
  const { year, month, day, hour, minute } = colomboParts(now);
  const todayStart = colomboLocalToDate(
    year,
    month,
    day,
    window.startHour,
    window.startMinute,
  );
  const todayEnd = colomboLocalToDate(
    year,
    month,
    day,
    window.endHour,
    window.endMinute,
  );
  if (now.getTime() <= todayEnd.getTime()) {
    return { start: todayStart, end: todayEnd };
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const t = colomboParts(tomorrow);
  return {
    start: colomboLocalToDate(
      t.year,
      t.month,
      t.day,
      window.startHour,
      window.startMinute,
    ),
    end: colomboLocalToDate(
      t.year,
      t.month,
      t.day,
      window.endHour,
      window.endMinute,
    ),
  };
}

export function applyPickupPreset(
  kind: PickupWindowKind,
  now: Date = new Date(),
): { start: Date; end: Date } {
  switch (kind) {
    case 'morning_bake':
    case 'lunch':
    case 'evening':
      return nextPresetOccurrence(kind, now);
    case 'immediately_2h':
      return {
        start: now,
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      };
    case 'now_4h':
      return {
        start: now,
        end: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      };
    case 'custom':
    default:
      return {
        start: now,
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      };
  }
}

export function applyPickupPresetLocal(
  kind: PickupWindowKind,
  now: Date = new Date(),
): { pickup_start: string; pickup_end: string } {
  const { start, end } = applyPickupPreset(kind, now);
  return {
    pickup_start: isoLocalRounded(start),
    pickup_end: isoLocalRounded(end),
  };
}

export function formatPickupKindLabel(
  kind: PickupWindowKind | string | null | undefined,
): string | null {
  switch (kind) {
    case 'morning_bake':
      return 'Morning Bake Window';
    case 'lunch':
      return 'Lunch Window';
    case 'evening':
      return 'Evening Window';
    case 'immediately_2h':
      return 'Immediately (2h)';
    case 'now_4h':
      return 'Now (4h)';
    case 'custom':
    default:
      return null;
  }
}

export function pickupBrowseState(
  nowMs: number,
  pickupStartIso: string | null | undefined,
  pickupEndIso: string | null | undefined,
): PickupBrowseState {
  const start = parsePickupMs(pickupStartIso);
  const end = parsePickupMs(pickupEndIso);
  if (end == null) return 'closed';
  if (isPickupWindowOpen(nowMs, pickupStartIso, pickupEndIso)) {
    return 'open_now';
  }
  if (nowMs > end) return 'closed';
  if (start != null && nowMs < start) {
    return 'opening_soon';
  }
  if (isApproachingWithin2h(nowMs, pickupEndIso)) {
    return 'opening_soon';
  }
  return 'closed';
}

export function formatPickupBrowsePill(
  nowMs: number,
  pickupStartIso: string | null | undefined,
  pickupEndIso: string | null | undefined,
): string | null {
  const state = pickupBrowseState(nowMs, pickupStartIso, pickupEndIso);
  if (state === 'open_now') return 'Open now';
  if (state === 'opening_soon') {
    const start = parsePickupMs(pickupStartIso);
    if (start == null) return 'Opens soon';
    const startDate = new Date(start);
    const time = startDate.toLocaleTimeString('en-LK', {
      timeZone: COLOMBO_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
    return `Opens at ${time}`;
  }
  return null;
}

export function timesMatchPreset(
  kind: PickupWindowKind,
  pickupStartLocal: string,
  pickupEndLocal: string,
  now: Date = new Date(),
): boolean {
  if (!NAMED_PRESET_KINDS.includes(kind as (typeof NAMED_PRESET_KINDS)[number])) {
    return false;
  }
  const expected = applyPickupPresetLocal(kind, now);
  return (
    pickupStartLocal === expected.pickup_start &&
    pickupEndLocal === expected.pickup_end
  );
}

export function parsePickupWindowKind(
  raw: unknown,
): PickupWindowKind {
  const s = typeof raw === 'string' ? raw : '';
  const allowed: PickupWindowKind[] = [
    'custom',
    'morning_bake',
    'lunch',
    'evening',
    'immediately_2h',
    'now_4h',
  ];
  return (allowed as string[]).includes(s) ? (s as PickupWindowKind) : 'custom';
}
