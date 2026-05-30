import {
  merchantBagsTabMeta,
  merchantInventoryTabMeta,
  merchantListingModeLabel,
  merchantShelvesTabMeta,
} from '@/lib/merchantTabInventory';

describe('merchantTabInventory', () => {
  it('supermarket tab is shelves-only', () => {
    expect(merchantInventoryTabMeta('supermarket')).toEqual({
      tabBarLabel: 'Shelves',
      headerTitle: 'Clearance shelves',
      iconName: 'inventory_2',
    });
  });

  it('bakery tab is bags-only', () => {
    expect(merchantInventoryTabMeta('bakery')).toEqual({
      tabBarLabel: 'Bags',
      headerTitle: 'Rescue bags',
      iconName: 'local_mall',
    });
  });

  it('hybrid uses dedicated bags and shelves tab meta', () => {
    expect(merchantBagsTabMeta('hybrid')).toEqual({
      tabBarLabel: 'Bags',
      headerTitle: 'Rescue bags',
      iconName: 'local_mall',
    });
    expect(merchantShelvesTabMeta()).toEqual({
      tabBarLabel: 'Shelves',
      headerTitle: 'Clearance shelves',
      iconName: 'inventory_2',
    });
    expect(merchantListingModeLabel('hybrid')).toBe('Rescue bags & shelves');
  });

  it('mode chip labels stay rule-based', () => {
    expect(merchantListingModeLabel('rescue_bag')).toBe('Rescue bags only');
    expect(merchantListingModeLabel('clearance_shelf')).toBe('Clearance shelves only');
  });
});
