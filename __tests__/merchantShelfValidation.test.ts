import {
  isPeakPublishHour,
  validateLkrRescuePrice,
  validateLkrRetailPrice,
} from '@/lib/merchantShelfValidation';

describe('merchantShelfValidation', () => {
  it('validates rescue price bands', () => {
    expect(validateLkrRescuePrice(9)).toMatch(/at least/);
    expect(validateLkrRescuePrice(100)).toBeNull();
    expect(validateLkrRescuePrice(60_000)).toMatch(/cannot exceed/);
  });

  it('validates retail vs rescue', () => {
    expect(validateLkrRetailPrice(50, 100)).toMatch(/at or above/);
    expect(validateLkrRetailPrice(200, 100)).toBeNull();
    expect(validateLkrRetailPrice(null, 100)).toBeNull();
  });

  it('detects peak publish hours', () => {
    expect(isPeakPublishHour(new Date('2026-05-30T12:00:00'))).toBe(true);
    expect(isPeakPublishHour(new Date('2026-05-30T08:00:00'))).toBe(false);
  });
});
