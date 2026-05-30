import {
  filterDiscoverFeedByListingMode,
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

  it('mapShelfToFeedItem preserves enriched item fields in payload', () => {
    const feedItem = mapShelfToFeedItem({
      id: 's2',
      outlet: { category: 'supermarket', name: 'Demo Mart' },
      items: [
        {
          id: 'i1',
          status: 'live',
          quantity_remaining: 2,
          rescue_price: 150,
          retail_price: 300,
          name_snapshot: 'Milk',
          brand_snapshot: 'Demo',
          product_id: 'p1',
        },
      ],
    });
    const payloadItems = (feedItem.payload.items ?? []) as Record<string, unknown>[];
    expect(payloadItems[0]).toMatchObject({
      name_snapshot: 'Milk',
      brand_snapshot: 'Demo',
      retail_price: 300,
      product_id: 'p1',
    });
  });
});
