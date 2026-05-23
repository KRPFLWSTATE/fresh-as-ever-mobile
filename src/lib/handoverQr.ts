/**
 * Parse a scanned QR / barcode payload into a 6-character reservation handover code.
 */
export function parseHandoverCodeFromScan(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/\s/g, '');
  if (!compact) return null;

  if (/^[A-Z0-9]{6}$/.test(compact)) {
    return compact;
  }

  const embedded = compact.match(/\b[A-Z0-9]{6}\b/);
  return embedded ? embedded[0] : null;
}
