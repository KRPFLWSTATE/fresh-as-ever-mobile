import {
  extractDistinctLandmarks,
  filterItemsByLandmarks,
  matchesDistanceFilter,
} from '@/lib/neighbourhoodFilter';

describe('neighbourhoodFilter', () => {
  const feed = [
    { id: '1', outlet_name: 'Bakehouse', landmark: 'Kollupitiya', distance_km: 1.2 },
    { id: '2', outlet_name: 'Kumbuk', landmark: 'Colombo 07', distance_km: 4.5 },
    { id: '3', outlet_name: 'Pettah Grocer', outlet_landmark: 'Pettah', distance_km: 2.8 },
  ];

  it('extracts sorted distinct landmarks from feed items', () => {
    expect(extractDistinctLandmarks(feed)).toEqual([
      'Colombo 07',
      'Kollupitiya',
      'Pettah',
    ]);
  });

  it('filters feed by multi-select neighbourhood chips', () => {
    expect(
      filterItemsByLandmarks(feed, ['Kollupitiya', 'Pettah']).map((i) => i.id),
    ).toEqual(['1', '3']);
  });

  it('returns full feed when no neighbourhoods selected', () => {
    expect(filterItemsByLandmarks(feed, [])).toHaveLength(3);
  });

  it('applies distance chip thresholds using distance_km', () => {
    expect(matchesDistanceFilter(feed[0], 'near')).toBe(true);
    expect(matchesDistanceFilter(feed[1], 'near')).toBe(false);
    expect(matchesDistanceFilter(feed[1], 'wide')).toBe(true);
    expect(matchesDistanceFilter(feed[1], 'any')).toBe(true);
  });

  it('computes haversine distance when distance_km is missing', () => {
    const item = {
      outlet_lat: 6.9271,
      outlet_lng: 79.8612,
    };
    expect(matchesDistanceFilter(item, 'near', 6.9271, 79.8612)).toBe(true);
  });
});
