import type { ResolvedRole } from '@/context/AuthContext';

/** Parse `preview=true` from deep links and in-app navigation params. */
export function parsePreviewQueryParam(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

export type ShelfPreviewMode = {
  /** Merchant-only banner + draft shelf fetch. */
  isMerchantPreview: boolean;
  /** NG9: hide basket, qty steppers, and checkout for any preview link. */
  isBrowseOnly: boolean;
};

export function resolveShelfPreviewMode(
  previewRequested: boolean,
  resolvedRole: ResolvedRole,
): ShelfPreviewMode {
  const isMerchantRole =
    resolvedRole === 'merchant' || resolvedRole === 'merchant_staff';
  return {
    isMerchantPreview: previewRequested && isMerchantRole,
    isBrowseOnly: previewRequested,
  };
}
