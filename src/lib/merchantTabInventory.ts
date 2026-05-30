import type { OutletListingMode } from '@/lib/outletListingMode';
import { outletListingMode } from '@/lib/outletListingMode';

export type MerchantInventoryTabMeta = {
  tabBarLabel: string;
  headerTitle: string;
  iconName: 'local_mall' | 'inventory_2' | 'storefront';
};

/** Single-mode inventory tab (supermarket shelves-only or café bags-only). */
export function merchantInventoryTabMeta(
  category: string | null | undefined,
): MerchantInventoryTabMeta {
  const mode = outletListingMode(category);
  if (mode === 'clearance_shelf') {
    return {
      tabBarLabel: 'Shelves',
      headerTitle: 'Clearance shelves',
      iconName: 'inventory_2',
    };
  }
  return {
    tabBarLabel: 'Bags',
    headerTitle: 'Rescue bags',
    iconName: 'local_mall',
  };
}

/** Hybrid mode — dedicated rescue bags tab. */
export function merchantBagsTabMeta(
  _category: string | null | undefined,
): MerchantInventoryTabMeta {
  return {
    tabBarLabel: 'Bags',
    headerTitle: 'Rescue bags',
    iconName: 'local_mall',
  };
}

/** Hybrid mode — dedicated clearance shelves tab. */
export function merchantShelvesTabMeta(): MerchantInventoryTabMeta {
  return {
    tabBarLabel: 'Shelves',
    headerTitle: 'Clearance shelves',
    iconName: 'inventory_2',
  };
}

export function merchantListingModeLabel(mode: OutletListingMode): string {
  if (mode === 'clearance_shelf') return 'Clearance shelves only';
  if (mode === 'hybrid') return 'Rescue bags & shelves';
  return 'Rescue bags only';
}
