import {
  assertUniqueNearbyBagIds,
  getDiscoverMarkerCoordinate,
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
