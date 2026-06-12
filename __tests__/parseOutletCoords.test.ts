import { parseOutletCoords } from '@/lib/parseOutletCoords';

describe('parseOutletCoords', () => {
  test('parses GeoJSON Point coordinates', () => {
    expect(
      parseOutletCoords({ type: 'Point', coordinates: [79.86, 6.9271] }),
    ).toEqual({ lat: 6.9271, lng: 79.86 });
  });

  test('parses string coordinates in GeoJSON array', () => {
    expect(
      parseOutletCoords({
        type: 'Point',
        coordinates: ['79.86', '6.9271'],
      }),
    ).toEqual({ lat: 6.9271, lng: 79.86 });
  });

  test('parses latitude / longitude keys', () => {
    expect(
      parseOutletCoords({ latitude: 1.5, longitude: 2.5 }),
    ).toEqual({ lat: 1.5, lng: 2.5 });
  });

  test('returns null for garbage', () => {
    expect(parseOutletCoords(null)).toBeNull();
    expect(parseOutletCoords({})).toBeNull();
    expect(parseOutletCoords({ type: 'Point', coordinates: [] })).toBeNull();
  });

  test('parses WKT POINT strings', () => {
    expect(parseOutletCoords('POINT(79.8655 6.9147)')).toEqual({
      lat: 6.9147,
      lng: 79.8655,
    });
  });

  test('parses PostGIS EWKB hex with SRID (PostgREST geography format)', () => {
    // SRID=4326;POINT(79.8655 6.9147) — Colombo, exactly what the live
    // `outlets.location` column returns through the Discover selects.
    const hex = '0101000020E610000008AC1C5A64F75340D49AE61DA7A81B40';
    const parsed = parseOutletCoords(hex);
    expect(parsed).not.toBeNull();
    expect(parsed!.lat).toBeCloseTo(6.9147, 4);
    expect(parsed!.lng).toBeCloseTo(79.8655, 4);
  });

  test('parses plain WKB hex without SRID', () => {
    const hex = '010100000008AC1C5A64F75340D49AE61DA7A81B40';
    const parsed = parseOutletCoords(hex);
    expect(parsed).not.toBeNull();
    expect(parsed!.lat).toBeCloseTo(6.9147, 4);
    expect(parsed!.lng).toBeCloseTo(79.8655, 4);
  });

  test('rejects WKB hex that is not a point or malformed', () => {
    // LineString type (2).
    expect(parseOutletCoords('0102000020E61000000000000000000000')).toBeNull();
    expect(parseOutletCoords('01010000')).toBeNull();
    expect(parseOutletCoords('zz01000020E610000008AC1C5A64F75340')).toBeNull();
  });
});
