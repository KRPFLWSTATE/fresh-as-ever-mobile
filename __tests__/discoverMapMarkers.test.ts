import {
  assertUniqueNearbyBagIds,
  buildDiscoverMapMarkersFromFeed,
  countFeedItemsWithValidMapCoords,
  getDiscoverMarkerCoordinate,
  isValidDiscoverOutletCoord,
} from '@/lib/discoverMapMarkers';

describe('assertUniqueNearbyBagIds', () => {
  test('allows unique IDs', () => {
    expect(() =>
      assertUniqueNearbyBagIds([{ id: 'a' }, { id: 'b' }]),
    ).not.toThrow();
  });

  test('rejects collisions', () => {
    expect(() =>
      assertUniqueNearbyBagIds([{ id: 'dup' }, { id: 'dup' }]),
    ).toThrow(/Duplicate bags id/);
  });
});

describe('isValidDiscoverOutletCoord', () => {
  test('rejects null island', () => {
    expect(isValidDiscoverOutletCoord(0, 0)).toBe(false);
  });

  test('accepts Colombo coords', () => {
    expect(isValidDiscoverOutletCoord(6.9147, 79.8655)).toBe(true);
  });
});

describe('buildDiscoverMapMarkersFromFeed', () => {
  const outletId = '00000000-0000-0000-0000-000000000003';

  test('dedupes bag and shelf at same outlet', () => {
    const markers = buildDiscoverMapMarkersFromFeed([
      {
        kind: 'bag',
        id: 'bag-1',
        title: 'Pastry Rescue',
        outlet_id: outletId,
        outlet_name: 'Bakehouse',
        outlet_lat: 6.9147,
        outlet_lng: 79.8655,
        category: 'Bakery',
      },
      {
        kind: 'shelf',
        id: 'shelf-1',
        outlet_id: outletId,
        outlet_name: 'Bakehouse',
        outlet_lat: 6.9147,
        outlet_lng: 79.8655,
        category: 'Supermarket',
      },
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0]?.outletId).toBe(outletId);
    expect(markers[0]?.feedKind).toBe('bag');
  });

  test('skips invalid coords and reports reason', () => {
    const skipped: string[] = [];
    const markers = buildDiscoverMapMarkersFromFeed(
      [
        {
          kind: 'bag',
          id: 'bad',
          outlet_lat: 0,
          outlet_lng: 0,
        },
        {
          kind: 'bag',
          id: 'good',
          outlet_id: 'other',
          outlet_lat: 6.9,
          outlet_lng: 79.86,
        },
      ],
      {
        onSkipInvalid: (_item, reason) => {
          skipped.push(reason);
        },
      },
    );

    expect(markers).toHaveLength(1);
    expect(skipped).toEqual(['invalid-coords']);
  });

  test('countFeedItemsWithValidMapCoords counts rows before dedupe', () => {
    const feed = [
      {
        kind: 'bag' as const,
        id: 'bag-1',
        outlet_lat: 6.9147,
        outlet_lng: 79.8655,
      },
      {
        kind: 'shelf' as const,
        id: 'shelf-1',
        outlet_lat: 6.9147,
        outlet_lng: 79.8655,
      },
      {
        kind: 'bag' as const,
        id: 'bad',
        outlet_lat: 0,
        outlet_lng: 0,
      },
    ];

    expect(countFeedItemsWithValidMapCoords(feed)).toBe(2);
    expect(buildDiscoverMapMarkersFromFeed(feed)).toHaveLength(1);
  });
});

describe('getDiscoverMarkerCoordinate', () => {
  const all = [
    { id: 'a', outlet_lat: 6.9, outlet_lng: 79.8 },
    { id: 'b', outlet_lat: 6.9, outlet_lng: 79.8 },
  ];

  test('returns exact coords when demo is off', () => {
    expect(getDiscoverMarkerCoordinate(all[0], all, false)).toEqual({
      latitude: 6.9,
      longitude: 79.8,
    });
  });

  test('offsets duplicates when demo is on', () => {
    const p0 = getDiscoverMarkerCoordinate(all[0], all, true);
    const p1 = getDiscoverMarkerCoordinate(all[1], all, true);
    const delta =
      Math.abs(p0.latitude - p1.latitude) + Math.abs(p0.longitude - p1.longitude);
    expect(delta).toBeGreaterThan(1e-5);
  });
});
