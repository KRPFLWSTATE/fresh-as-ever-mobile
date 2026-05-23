import 'react-native-get-random-values';

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function fillRandom(bytes: Uint8Array): void {
  const c = (globalThis as unknown as { crypto?: { getRandomValues: (a: Uint8Array) => Uint8Array } })
    .crypto;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  c.getRandomValues(bytes);
}

/** Six-character reservation code; cryptographically secure via getRandomValues. */
export function randomReservationCode(length = 6): string {
  const n = Math.min(Math.max(length, 4), 12);
  const bytes = new Uint8Array(n);
  fillRandom(bytes);
  let out = '';
  for (let i = 0; i < n; i += 1) {
    out += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return out;
}
