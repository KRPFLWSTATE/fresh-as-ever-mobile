/** Shelf basket holds prices for 15 minutes after the last change. */
export const BASKET_TTL_MS = 15 * 60 * 1000;

export function basketExpiresAt(startedAtMs: number): number {
  return startedAtMs + BASKET_TTL_MS;
}

export function remainingBasketMs(startedAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, basketExpiresAt(startedAtMs) - nowMs);
}

export function isBasketExpired(startedAtMs: number, nowMs: number = Date.now()): boolean {
  return remainingBasketMs(startedAtMs, nowMs) <= 0;
}

export function formatBasketCountdown(remainingMs: number): string {
  const totalSec = Math.ceil(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Calm → warmer accent when under one minute. */
export function basketTimerTone(remainingMs: number): 'calm' | 'warm' | 'expired' {
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= 60_000) return 'warm';
  return 'calm';
}
