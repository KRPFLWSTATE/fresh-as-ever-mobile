import {
  filterDiscoverFeedByListingMode,
  filterDiscoverFeedByMerchantStatus,
  isOutletDiscoverVisible,
  mapBagToFeedItem,
  mapShelfToFeedItem,
} from '@/lib/discoverFeed';

describe('filterDiscoverFeedByListingMode', () => {
  it('drops bags from supermarket-only outlets', () => {
    const feed = filterDiscoverFeedByListingMode([
      mapBagToFeedItem({
        id: 'b1',
        title: 'Should hide',
        outlet_category: 'supermarket',
      }),
      mapShelfToFeedItem({
        id: 's1',
        outlet: { category: 'supermarket' },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id)).toEqual(['s1']);
  });

  it('keeps bags and shelves for hybrid outlets', () => {
    const feed = filterDiscoverFeedByListingMode([
      mapBagToFeedItem({
        id: 'b1',
        title: 'Hotel bag',
        outlet_category: 'hybrid',
      }),
      mapShelfToFeedItem({
        id: 's1',
        outlet: { category: 'hybrid' },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id).sort()).toEqual(['b1', 's1']);
  });

  it('drops shelves from bakery-only outlets', () => {
    const feed = filterDiscoverFeedByListingMode([
      mapBagToFeedItem({
        id: 'b1',
        title: 'Croissants',
        outlet_category: 'bakery',
      }),
      mapShelfToFeedItem({
        id: 's1',
        outlet: { category: 'bakery' },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id)).toEqual(['b1']);
  });

  it('mapBagToFeedItem preserves pickup_window_kind from RPC row', () => {
    const feedItem = mapBagToFeedItem({
      id: 'b-kind',
      title: 'Evening bag',
      pickup_window_kind: 'evening',
      outlet_category: 'bakery',
    });
    expect((feedItem.payload as Record<string, unknown>).pickup_window_kind).toBe('evening');
  });
});

describe('filterDiscoverFeedByMerchantStatus', () => {
  it('keeps flat RPC bag rows that omit nested outlet joins', () => {
    const feed = filterDiscoverFeedByMerchantStatus([
      mapBagToFeedItem({
        id: 'b-flat',
        title: 'Pastry Rescue',
        outlet_category: 'hybrid',
      }),
      mapShelfToFeedItem({
        id: 's1',
        outlet: {
          category: 'hybrid',
          is_active: true,
          merchant: { status: 'approved' },
        },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id).sort()).toEqual(['b-flat', 's1']);
  });

  it('hides feed items when merchant is suspended', () => {
    const feed = filterDiscoverFeedByMerchantStatus([
      mapBagToFeedItem({
        id: 'b1',
        title: 'Hidden bag',
        outlet_category: 'hybrid',
        outlet: { is_active: true, merchant: { status: 'suspended' } },
      }),
      mapShelfToFeedItem({
        id: 's1',
        outlet: {
          category: 'hybrid',
          is_active: true,
          merchant: { status: 'approved' },
        },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id)).toEqual(['s1']);
  });

  it('hides feed items when outlet is paused', () => {
    expect(
      isOutletDiscoverVisible({
        is_active: false,
        merchant: { status: 'approved' },
      }),
    ).toBe(false);
  });

  it('hides feed items when merchant status is missing (RLS join gap)', () => {
    expect(
      isOutletDiscoverVisible({
        is_active: true,
        merchant: undefined,
      }),
    ).toBe(false);
  });

  it('hides seed_demo shelves when outlet use_demo_listings is false', () => {
    const feed = filterDiscoverFeedByMerchantStatus([
      mapShelfToFeedItem({
        id: 's-demo',
        seed_demo: true,
        outlet: {
          category: 'hybrid',
          is_active: true,
          use_demo_listings: false,
          merchant: { status: 'approved' },
        },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
      mapShelfToFeedItem({
        id: 's-real',
        seed_demo: false,
        outlet: {
          category: 'hybrid',
          is_active: true,
          use_demo_listings: false,
          merchant: { status: 'approved' },
        },
        items: [{ status: 'live', quantity_remaining: 1, rescue_price: 10 }],
      }),
    ]);
    expect(feed.map((f) => f.id)).toEqual(['s-real']);
  });
});
