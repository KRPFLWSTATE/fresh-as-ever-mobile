import {
  merchantInventoryVisibility,
  pickMerchantInventoryListKind,
} from '@/lib/merchantInventoryVisibility';

jest.mock('@/config/clearanceShelves', () => ({
  isClearanceShelvesEnabled: jest.fn(() => true),
}));

describe('merchantInventoryVisibility', () => {
  it('supermarket shows shelves only, never bags', () => {
    const v = merchantInventoryVisibility('supermarket');
    expect(v.mode).toBe('clearance_shelf');
    expect(v.showBags).toBe(false);
    expect(v.showShelves).toBe(true);
    expect(v.isHybrid).toBe(false);
  });

  it('bakery shows bags only when clearance is on', () => {
    const v = merchantInventoryVisibility('bakery');
    expect(v.mode).toBe('rescue_bag');
    expect(v.showBags).toBe(true);
    expect(v.showShelves).toBe(false);
    expect(v.isHybrid).toBe(false);
  });

  it('hybrid shows both tabs', () => {
    const v = merchantInventoryVisibility('hybrid');
    expect(v.mode).toBe('hybrid');
    expect(v.showBags).toBe(true);
    expect(v.showShelves).toBe(true);
    expect(v.isHybrid).toBe(true);
  });

  it('pickMerchantInventoryListKind never swaps bags and shelves', () => {
    expect(pickMerchantInventoryListKind('supermarket')).toBe('shelves');
    expect(pickMerchantInventoryListKind('bakery')).toBe('bags');
    expect(pickMerchantInventoryListKind('cafe')).toBe('bags');
    expect(pickMerchantInventoryListKind('restaurant')).toBe('bags');
    expect(pickMerchantInventoryListKind('hybrid')).toBe('none');
  });

  it('supermarket still shows merchant shelves tab when clearance flag is off', () => {
    const { isClearanceShelvesEnabled } = jest.requireMock('@/config/clearanceShelves');
    isClearanceShelvesEnabled.mockReturnValueOnce(false);
    const v = merchantInventoryVisibility('supermarket');
    expect(v.showBags).toBe(false);
    expect(v.showShelves).toBe(true);
    expect(v.clearanceOn).toBe(false);
  });
});
