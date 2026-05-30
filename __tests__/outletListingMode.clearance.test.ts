import {
  outletListingMode,
  canPublishClearanceShelves,
  canPublishRescueBags,
} from '@/lib/outletListingMode';

describe('outletListingMode clearance', () => {
  it('supermarket is clearance only', () => {
    expect(outletListingMode('supermarket')).toBe('clearance_shelf');
    expect(canPublishClearanceShelves('supermarket')).toBe(true);
    expect(canPublishRescueBags('supermarket')).toBe(false);
  });

  it('hotel is hybrid', () => {
    expect(outletListingMode('hotel')).toBe('hybrid');
    expect(canPublishClearanceShelves('hotel')).toBe(true);
    expect(canPublishRescueBags('hotel')).toBe(true);
  });

  it('hybrid category is dual mode', () => {
    expect(outletListingMode('hybrid')).toBe('hybrid');
    expect(canPublishClearanceShelves('hybrid')).toBe(true);
    expect(canPublishRescueBags('hybrid')).toBe(true);
  });
});
