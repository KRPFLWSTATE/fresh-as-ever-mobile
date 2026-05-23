import {
  SRI_LANKA_LOCATION_PRESETS,
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
