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
});
