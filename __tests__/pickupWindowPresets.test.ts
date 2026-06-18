import {
  applyPickupPreset,
  applyPickupPresetLocal,
  colomboLocalToDate,
  COLOMBO_TZ,
  formatPickupBrowsePill,
  formatPickupKindLabel,
  pickupBrowseState,
} from '@/lib/pickupWindowPresets';

describe('pickupWindowPresets', () => {
  it('formatPickupKindLabel returns human labels for named kinds', () => {
    expect(formatPickupKindLabel('morning_bake')).toBe('Morning Bake Window');
    expect(formatPickupKindLabel('lunch')).toBe('Lunch Window');
    expect(formatPickupKindLabel('evening')).toBe('Evening Window');
    expect(formatPickupKindLabel('custom')).toBeNull();
  });

  it('applyPickupPreset morning_bake uses Colombo 05:30–09:30', () => {
    const now = colomboLocalToDate(2026, 6, 20, 8, 0);
    const { start, end } = applyPickupPreset('morning_bake', now);
    expect(start.toISOString()).toBe(colomboLocalToDate(2026, 6, 20, 5, 30).toISOString());
    expect(end.toISOString()).toBe(colomboLocalToDate(2026, 6, 20, 9, 30).toISOString());
  });

  it('applyPickupPreset rolls morning_bake to next day after window ends', () => {
    const now = colomboLocalToDate(2026, 6, 20, 10, 0);
    const { start } = applyPickupPreset('morning_bake', now);
    expect(start.toISOString()).toBe(colomboLocalToDate(2026, 6, 21, 5, 30).toISOString());
  });

  it('applyPickupPresetLocal returns datetime-local strings', () => {
    const now = colomboLocalToDate(2026, 6, 20, 12, 0);
    const lunch = applyPickupPresetLocal('lunch', now);
    expect(lunch.pickup_start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(lunch.pickup_end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('pickupBrowseState open_now inside window', () => {
    const start = colomboLocalToDate(2026, 6, 20, 11, 30).toISOString();
    const end = colomboLocalToDate(2026, 6, 20, 14, 30).toISOString();
    const nowMs = colomboLocalToDate(2026, 6, 20, 12, 0).getTime();
    expect(pickupBrowseState(nowMs, start, end)).toBe('open_now');
    expect(formatPickupBrowsePill(nowMs, start, end)).toBe('Open now');
  });

  it('pickupBrowseState opening_soon before start', () => {
    const start = colomboLocalToDate(2026, 6, 20, 17, 0).toISOString();
    const end = colomboLocalToDate(2026, 6, 20, 21, 0).toISOString();
    const nowMs = colomboLocalToDate(2026, 6, 20, 16, 0).getTime();
    expect(pickupBrowseState(nowMs, start, end)).toBe('opening_soon');
    const pill = formatPickupBrowsePill(nowMs, start, end);
    expect(pill).toMatch(/^Opens at /);
  });

  it('pickupBrowseState closed after end', () => {
    const start = colomboLocalToDate(2026, 6, 20, 11, 30).toISOString();
    const end = colomboLocalToDate(2026, 6, 20, 14, 30).toISOString();
    const nowMs = colomboLocalToDate(2026, 6, 20, 15, 0).getTime();
    expect(pickupBrowseState(nowMs, start, end)).toBe('closed');
    expect(formatPickupBrowsePill(nowMs, start, end)).toBeNull();
  });

  it('uses Asia/Colombo timezone constant', () => {
    expect(COLOMBO_TZ).toBe('Asia/Colombo');
  });
});
