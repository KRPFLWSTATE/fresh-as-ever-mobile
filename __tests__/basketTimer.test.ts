import {
  BASKET_TTL_MS,
  basketTimerTone,
  formatBasketCountdown,
  isBasketExpired,
  remainingBasketMs,
} from '@/lib/basketTimer';

describe('basketTimer', () => {
  const started = 1_000_000;

  it('formats MM:SS countdown', () => {
    expect(formatBasketCountdown(15 * 60 * 1000)).toBe('15:00');
    expect(formatBasketCountdown(59_000)).toBe('00:59');
  });

  it('expires after 15 minutes', () => {
    expect(remainingBasketMs(started, started + BASKET_TTL_MS - 1)).toBe(1);
    expect(isBasketExpired(started, started + BASKET_TTL_MS)).toBe(true);
  });

  it('shifts tone in the final minute', () => {
    expect(basketTimerTone(120_000)).toBe('calm');
    expect(basketTimerTone(30_000)).toBe('warm');
    expect(basketTimerTone(0)).toBe('expired');
  });
});
