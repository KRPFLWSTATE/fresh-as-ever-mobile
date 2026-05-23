import { formatPickupOpensAt } from '@/domain/pickupWindow';

describe('formatPickupOpensAt', () => {
  it('formats a future pickup start in en-LK style', () => {
    const iso = '2030-06-15T15:00:00.000Z';
    const now = new Date('2030-06-15T12:00:00.000Z').getTime();
    const label = formatPickupOpensAt(iso, now);
    expect(label).toMatch(/^Pickup opens at/);
    expect(label).not.toContain('T15:00');
  });

  it('returns TBC when iso missing', () => {
    expect(formatPickupOpensAt(null)).toBe('Pickup time to be confirmed');
  });
});
