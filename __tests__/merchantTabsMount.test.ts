import { merchantInventoryVisibility } from '@/lib/merchantInventoryVisibility';

/** Mirrors `MerchantTabsScreen` tab mounting in RootNavigator.tsx. */
function merchantTabMountPlan(category: string) {
  const { showShelves, showBags, isHybrid } = merchantInventoryVisibility(category);
  const showSingleInventoryTab = (showBags || showShelves) && !isHybrid;
  return {
    bagsTab: showSingleInventoryTab || (isHybrid && showBags),
    shelvesTab: isHybrid && showShelves,
    tabCount: 3 + (showSingleInventoryTab || isHybrid ? (isHybrid ? 2 : 1) : 0),
  };
}

describe('merchantTabsMount', () => {
  it('bakery: 4 tabs, bags inventory only', () => {
    const p = merchantTabMountPlan('bakery');
    expect(p.bagsTab).toBe(true);
    expect(p.shelvesTab).toBe(false);
    expect(p.tabCount).toBe(4);
  });

  it('supermarket: 4 tabs, shelves inventory only', () => {
    const p = merchantTabMountPlan('supermarket');
    expect(p.bagsTab).toBe(true);
    expect(p.shelvesTab).toBe(false);
    expect(p.tabCount).toBe(4);
  });

  it('hybrid: 5 tabs, bags and shelves', () => {
    const p = merchantTabMountPlan('hybrid');
    expect(p.bagsTab).toBe(true);
    expect(p.shelvesTab).toBe(true);
    expect(p.tabCount).toBe(5);
  });
});
