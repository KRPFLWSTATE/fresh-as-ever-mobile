import {
  bagVisibilityIssue,
  bagVisibilityIssueLabel,
  isBagCustomerVisible,
  isDemoListingVisible,
  isDemoShelfDateCurrent,
  isOutletDiscoverVisible,
  isShelfCustomerVisible,
  shelfVisibilityIssue,
  utcTodayIsoDate,
} from '@/domain/listingVisibility';

const approvedOutlet = {
  is_active: true,
  use_demo_listings: true,
  merchant: { status: 'approved' },
};

const openBag = {
  status: 'live',
  quantity_remaining: 3,
  pickup_end: new Date(Date.now() + 3_600_000).toISOString(),
  outlet: approvedOutlet,
};

describe('listingVisibility', () => {
  it('accepts live bag with open pickup window', () => {
    expect(isBagCustomerVisible(openBag)).toBe(true);
    expect(bagVisibilityIssue(openBag)).toBeNull();
  });

  it('rejects expired pickup window', () => {
    const bag = {
      ...openBag,
      pickup_end: new Date(Date.now() - 60_000).toISOString(),
    };
    expect(bagVisibilityIssue(bag)).toBe('pickup_ended');
    expect(bagVisibilityIssueLabel('pickup_ended')).toBe('Pickup ended');
  });

  it('rejects draft and sold out bags', () => {
    expect(bagVisibilityIssue({ ...openBag, status: 'draft' })).toBe('not_live');
    expect(bagVisibilityIssue({ ...openBag, quantity_remaining: 0 })).toBe('sold_out');
  });

  it('rejects paused outlet and non-approved merchant', () => {
    expect(
      bagVisibilityIssue({
        ...openBag,
        outlet: { ...approvedOutlet, is_active: false },
      }),
    ).toBe('outlet_inactive');
    expect(
      bagVisibilityIssue({
        ...openBag,
        outlet: { ...approvedOutlet, merchant: { status: 'suspended' } },
      }),
    ).toBe('merchant_not_approved');
  });

  it('rejects demo bag when outlet demos are disabled', () => {
    expect(
      isDemoListingVisible(true, { ...approvedOutlet, use_demo_listings: false }),
    ).toBe(false);
    expect(
      bagVisibilityIssue({
        ...openBag,
        seed_demo: true,
        outlet: { ...approvedOutlet, use_demo_listings: false },
      }),
    ).toBe('demo_disabled');
  });

  it('validates shelf visibility including demo shelf_date', () => {
    const shelf = {
      status: 'published',
      pickup_end: new Date(Date.now() + 3_600_000).toISOString(),
      shelf_date: utcTodayIsoDate(),
      seed_demo: true,
      outlet: approvedOutlet,
      items: [{ status: 'live', quantity_remaining: 2 }],
    };
    expect(isShelfCustomerVisible(shelf)).toBe(true);

    const stale = { ...shelf, shelf_date: '2020-01-01' };
    expect(shelfVisibilityIssue(stale)).toBe('shelf_date_stale');
  });

  it('isOutletDiscoverVisible requires merchant status', () => {
    expect(isOutletDiscoverVisible(approvedOutlet)).toBe(true);
    expect(isOutletDiscoverVisible({ is_active: true, merchant: undefined })).toBe(false);
  });

  it('isDemoShelfDateCurrent skips non-demo shelves', () => {
    expect(isDemoShelfDateCurrent({ seed_demo: false, shelf_date: '2020-01-01' })).toBe(true);
  });
});
