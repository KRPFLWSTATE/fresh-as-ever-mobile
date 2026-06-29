/** Lightweight cross-hook refresh signal after merchant order mutations (e.g. handover). */

let revision = 0;
const listeners = new Set<() => void>();

export function bumpMerchantDataRevision(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function getMerchantDataRevision(): number {
  return revision;
}

export function subscribeMerchantDataRevision(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
