import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import {
  canPublishClearanceShelves,
  canPublishRescueBags,
  outletListingMode,
  type OutletListingMode,
} from '@/lib/outletListingMode';

export type MerchantInventoryVisibility = {
  mode: OutletListingMode;
  clearanceOn: boolean;
  showShelves: boolean;
  showBags: boolean;
  /** Both rescue bags and clearance shelves are active for this outlet. */
  isHybrid: boolean;
};

/** Centralizes feature-flag + category rules for merchant inventory surfaces. */
export function merchantInventoryVisibility(
  category: string | null | undefined,
): MerchantInventoryVisibility {
  const clearanceOn = isClearanceShelvesEnabled();
  const mode = outletListingMode(category);
  /** Merchant inventory follows category; customer Discover still uses `clearanceOn`. */
  const showShelves = canPublishClearanceShelves(category);
  /** Category is source of truth — never show bags for supermarket even when clearance flag is off. */
  const showBags = canPublishRescueBags(category);
  return {
    mode,
    clearanceOn,
    showShelves,
    showBags,
    isHybrid: showShelves && showBags,
  };
}

export type MerchantInventoryListKind = 'bags' | 'shelves' | 'none';

/** Which list screen a single-mode inventory tab should mount (never swap bags/shelves). */
export function pickMerchantInventoryListKind(
  category: string | null | undefined,
): MerchantInventoryListKind {
  const { showShelves, showBags } = merchantInventoryVisibility(category);
  if (showShelves && !showBags) return 'shelves';
  if (showBags && !showShelves) return 'bags';
  return 'none';
}
