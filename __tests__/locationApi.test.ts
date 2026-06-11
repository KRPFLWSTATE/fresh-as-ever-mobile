import {
  SRI_LANKA_LOCATION_PRESETS,
  fetchLocationReverse,
  fetchNominatimLocationReverse,
  fetchLocationSearch,
} from '@/lib/locationApi';

describe('fetchLocationSearch presets', () => {
  it('returns Colombo presets when API base is missing', async () => {
    const { results, apiBaseUrlMissing, usedClientFallback } = await fetchLocationSearch(
      { supabaseUrl: '', supabaseAnonKey: '', apiBaseUrl: '', payHereReturnHost: '' },
      'colombo',
    );
    expect(apiBaseUrlMissing).toBe(true);
    expect(usedClientFallback).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.label.toLowerCase().includes('colombo'))).toBe(true);
  });

  it('includes known Sri Lanka fallback coordinates', () => {
    expect(SRI_LANKA_LOCATION_PRESETS[0].label).toMatch(/Colombo/);
    expect(SRI_LANKA_LOCATION_PRESETS[0].lat).toBeGreaterThan(6);
  });
});

describe('fetchLocationReverse', () => {
  const env = { supabaseUrl: '', supabaseAnonKey: '', apiBaseUrl: '', payHereReturnHost: '' };

  it('falls back to Nominatim when API base is missing', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'Colombo Fort, Sri Lanka' }),
    } as Response);

    const label = await fetchLocationReverse(env, 6.9271, 79.8612);
    expect(label).toBe('Colombo Fort, Sri Lanka');
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('fetchNominatimLocationReverse returns empty for invalid coords', async () => {
    const label = await fetchNominatimLocationReverse(Number.NaN, 79.86);
    expect(label).toBe('');
  });
});
