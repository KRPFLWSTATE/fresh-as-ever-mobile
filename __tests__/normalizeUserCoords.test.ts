import { isRunningInSimulator } from '@/lib/isRunningInSimulator';
import {
  normalizeUserCoords,
  isPlausibleUserCoords,
} from '@/lib/normalizeUserCoords';

jest.mock('@/lib/isRunningInSimulator', () => ({
  isRunningInSimulator: jest.fn(() => false),
}));

const mockIsRunningInSimulator = jest.mocked(isRunningInSimulator);

describe('normalizeUserCoords', () => {
  beforeEach(() => {
    mockIsRunningInSimulator.mockReturnValue(false);
  });

  it('accepts Colombo Fort', () => {
    expect(normalizeUserCoords(6.9271, 79.8612)).toEqual({
      lat: 6.9271,
      lng: 79.8612,
    });
  });

  it('swaps lat/lng when longitude was stored as latitude (Arctic bug)', () => {
    expect(normalizeUserCoords(79.8612, 6.9271)).toEqual({
      lat: 6.9271,
      lng: 79.8612,
    });
  });

  it('rejects Arctic without swap pattern on device', () => {
    expect(normalizeUserCoords(75, 10)).toBeNull();
  });

  it('rejects US West Coast (Freeway Drive) on physical device', () => {
    expect(normalizeUserCoords(37.3346, -122.009)).toBeNull();
  });

  it('rejects non-finite', () => {
    expect(normalizeUserCoords(Number.NaN, 79)).toBeNull();
  });

  it('rejects |lat| > 90 even on simulator', () => {
    mockIsRunningInSimulator.mockReturnValue(true);
    expect(normalizeUserCoords(91, 0)).toBeNull();
  });

  describe('simulator', () => {
    beforeEach(() => {
      mockIsRunningInSimulator.mockReturnValue(true);
    });

    it('accepts Freeway Drive / SF-ish coords', () => {
      expect(normalizeUserCoords(37.3346, -122.009)).toEqual({
        lat: 37.3346,
        lng: -122.009,
      });
    });

    it('still accepts Colombo', () => {
      expect(normalizeUserCoords(6.9271, 79.8612)).toEqual({
        lat: 6.9271,
        lng: 79.8612,
      });
    });

    it('still swaps Colombo lat/lng inversion', () => {
      expect(normalizeUserCoords(79.8612, 6.9271)).toEqual({
        lat: 6.9271,
        lng: 79.8612,
      });
    });
  });
});

describe('isPlausibleUserCoords', () => {
  beforeEach(() => {
    mockIsRunningInSimulator.mockReturnValue(false);
  });

  it('matches normalizeUserCoords on device', () => {
    expect(isPlausibleUserCoords(6.9271, 79.8612)).toBe(true);
    expect(isPlausibleUserCoords(79.8612, 6.9271)).toBe(true);
    expect(isPlausibleUserCoords(75, 10)).toBe(false);
    expect(isPlausibleUserCoords(37.3346, -122.009)).toBe(false);
  });

  it('accepts US coords when simulator flag is true', () => {
    mockIsRunningInSimulator.mockReturnValue(true);
    expect(isPlausibleUserCoords(37.3346, -122.009)).toBe(true);
  });
});
