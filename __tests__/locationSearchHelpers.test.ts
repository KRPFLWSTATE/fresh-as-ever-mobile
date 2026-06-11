import {
  dedupeLocationHits,
  geocodeTypedAddress,
  normalizeLocationLabel,
  normalizeNativeEditText,
  pickForwardGeocodeHit,
  shortenLocationLabel,
} from '@/lib/locationSearchHelpers';
import { fetchLocationSearch } from '@/lib/locationApi';

jest.mock('@/lib/locationApi', () => ({
  fetchLocationSearch: jest.fn(),
}));

const env = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  apiBaseUrl: '',
  payHereReturnHost: '',
};

describe('locationSearchHelpers', () => {
  describe('normalizeNativeEditText', () => {
    it('removes appended baseline suffix from iOS setValue artifact', () => {
      expect(
        normalizeNativeEditText(
          '12 Ward Place, Colombo 07Colombo 07, Sri Lanka',
          'Colombo 07, Sri Lanka',
        ),
      ).toBe('12 Ward Place, Colombo 07');
    });

    it('returns text unchanged when baseline is not a suffix', () => {
      expect(normalizeNativeEditText('Colombo 03', 'Colombo 07, Sri Lanka')).toBe('Colombo 03');
    });
  });

  describe('normalizeLocationLabel', () => {
    it('lowercases and collapses whitespace', () => {
      expect(normalizeLocationLabel('  Colombo  07 ')).toBe('colombo 07');
    });
  });

  describe('shortenLocationLabel', () => {
    it('keeps short labels unchanged', () => {
      expect(shortenLocationLabel('Colombo 07, Sri Lanka')).toBe('Colombo 07, Sri Lanka');
    });

    it('shortens long Nominatim strings to venue + area', () => {
      const long =
        'Sri Lanka Football House, 12 Ward Place, Colombo 07, Colombo, Western Province, 00700, Sri Lanka';
      expect(shortenLocationLabel(long)).toBe(
        'Sri Lanka Football House, Colombo 07',
      );
    });
  });

  describe('dedupeLocationHits', () => {
    it('collapses near-duplicate venue rows with similar coords', () => {
      const hits = [
        {
          label:
            'Sri Lanka Football House, 12 Ward Place, Colombo 07, Colombo, Western Province, Sri Lanka',
          lat: 6.9147,
          lng: 79.8655,
        },
        {
          label:
            'Sri Lanka Football House, Ward Place, Colombo 07, Colombo, Western Province, Sri Lanka',
          lat: 6.9148,
          lng: 79.8656,
        },
        {
          label: 'Independence Square, Colombo 07, Sri Lanka',
          lat: 6.916,
          lng: 79.868,
        },
      ];

      const deduped = dedupeLocationHits(hits);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].label).toContain('Sri Lanka Football House');
      expect(deduped[1].label).toContain('Independence Square');
    });

    it('limits results to maxResults', () => {
      const hits = Array.from({ length: 8 }, (_, i) => ({
        label: `Place ${i}, Colombo ${String(i).padStart(2, '0')}, Sri Lanka`,
        lat: 6.9 + i * 0.01,
        lng: 79.86 + i * 0.01,
      }));
      expect(dedupeLocationHits(hits, { maxResults: 3 })).toHaveLength(3);
    });
  });

  describe('pickForwardGeocodeHit', () => {
    const hits = [
      { label: '12 Ward Place, Colombo 07', lat: 6.914, lng: 79.865 },
      { label: 'Colombo 07, Sri Lanka', lat: 6.915, lng: 79.866 },
    ];

    it('returns null for empty hits', () => {
      expect(pickForwardGeocodeHit('Colombo', [])).toBeNull();
    });

    it('returns single hit when only one result', () => {
      expect(pickForwardGeocodeHit('x', [hits[0]])).toEqual(hits[0]);
    });

    it('prefers prefix match for typed address', () => {
      const picked = pickForwardGeocodeHit('12 Ward Place, Colombo 07', hits);
      expect(picked?.label).toBe('12 Ward Place, Colombo 07');
    });

    it('falls back to first hit when query is long enough', () => {
      const picked = pickForwardGeocodeHit('some unknown street colombo', hits);
      expect(picked).toEqual(hits[0]);
    });

    it('returns null for short ambiguous query with multiple hits', () => {
      expect(pickForwardGeocodeHit('ab', hits)).toBeNull();
    });
  });

  describe('geocodeTypedAddress', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns null when query is too short', async () => {
      expect(await geocodeTypedAddress(env, 'ab', 4)).toBeNull();
      expect(fetchLocationSearch).not.toHaveBeenCalled();
    });

    it('forward-geocodes and picks confident hit', async () => {
      (fetchLocationSearch as jest.Mock).mockResolvedValue({
        results: [
          {
            label: '12 Ward Place, Colombo 07, Sri Lanka',
            lat: 6.914,
            lng: 79.865,
          },
        ],
        apiBaseUrlMissing: true,
        usedClientFallback: true,
      });

      const hit = await geocodeTypedAddress(env, '12 Ward Place, Colombo 07', 4);
      expect(fetchLocationSearch).toHaveBeenCalledWith(env, '12 Ward Place, Colombo 07');
      expect(hit?.lat).toBe(6.914);
      expect(hit?.lng).toBe(79.865);
    });
  });
});
