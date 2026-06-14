import {
  CUSTOMER_ARRIVAL_EARLY_MS,
  formatLatenessLabel,
  formatMerchantPickupWindow,
  isApproachingWithin2h,
  isCustomerArrivalEligible,
  isLatePickup,
  isNoShowGraceElapsed,
  formatPickupLine,
  isPickupWindowOpen,
  lateSeverityFromMinutes,
  minutesPastPickupEnd,
} from '@/domain/pickupWindow';

const t = (iso: string) => new Date(iso).getTime();

describe('pickupWindow', () => {
  const start = '2026-05-20T10:00:00.000Z';
  const end = '2026-05-20T12:00:00.000Z';

  it('isPickupWindowOpen inside window', () => {
    expect(isPickupWindowOpen(t('2026-05-20T11:00:00.000Z'), start, end)).toBe(true);
  });

  it('isPickupWindowOpen before start', () => {
    expect(isPickupWindowOpen(t('2026-05-20T09:00:00.000Z'), start, end)).toBe(false);
  });

  it('isCustomerArrivalEligible 15m before start', () => {
    const early = new Date(t(start) - CUSTOMER_ARRIVAL_EARLY_MS + 60_000).toISOString();
    expect(isCustomerArrivalEligible(t(early), start, end)).toBe(true);
    expect(isCustomerArrivalEligible(t('2026-05-20T09:00:00.000Z'), start, end)).toBe(false);
  });

  it('isLatePickup after end', () => {
    expect(isLatePickup(t('2026-05-20T13:00:00.000Z'), end)).toBe(true);
  });

  it('isApproachingWithin2h', () => {
    const now = t('2026-05-20T11:30:00.000Z');
    expect(isApproachingWithin2h(now, end)).toBe(true);
  });

  it('late severity buckets', () => {
    expect(lateSeverityFromMinutes(5)).toBe('recent');
    expect(lateSeverityFromMinutes(20)).toBe('moderate');
    expect(lateSeverityFromMinutes(45)).toBe('critical');
  });

  it('no-show grace 30m after end', () => {
    const endMs = t(end);
    expect(isNoShowGraceElapsed(end, endMs + 29 * 60_000)).toBe(false);
    expect(isNoShowGraceElapsed(end, endMs + 31 * 60_000)).toBe(true);
  });

  it('minutesPastPickupEnd', () => {
    expect(minutesPastPickupEnd(t('2026-05-20T12:45:00.000Z'), end)).toBe(45);
  });

  it('formatPickupLine returns TBC when missing', () => {
    expect(formatPickupLine(null, end)).toBe('Pickup time TBC');
  });

  it('formatPickupLine includes end day when window crosses midnight', () => {
    const line = formatPickupLine(
      '2026-06-13T17:00:00.000Z',
      '2026-06-14T02:00:00.000Z',
      Date.parse('2026-06-14T10:00:00.000Z'),
    );
    expect(line).toMatch(/ - /);
    expect(line).toContain('Yesterday');
    expect(line).toContain('Today');
  });

  it('formatMerchantPickupWindow includes end day for overnight windows', () => {
    const line = formatMerchantPickupWindow(
      '2026-06-13T10:28:00.000Z',
      '2026-06-14T02:00:00.000Z',
      Date.parse('2026-06-14T10:00:00.000Z'),
    );
    expect(line.split('–').length).toBeGreaterThan(1);
  });

  it('formatLatenessLabel scales hours and avoids raw minute spam', () => {
    expect(formatLatenessLabel(45)).toBe('45m late');
    expect(formatLatenessLabel(781)).toBe('13h 1m late');
    expect(formatLatenessLabel(120)).toBe('2h late');
  });
});
