/** LKR price band validation for merchant shelf item inputs. */

export const LKR_RESCUE_MIN = 10;
export const LKR_RESCUE_MAX = 50_000;
export const LKR_RETAIL_MAX = 100_000;

export function validateLkrRescuePrice(value: number): string | null {
  if (!Number.isFinite(value) || value < LKR_RESCUE_MIN) {
    return `Rescue price must be at least Rs. ${LKR_RESCUE_MIN}.`;
  }
  if (value > LKR_RESCUE_MAX) {
    return `Rescue price cannot exceed Rs. ${LKR_RESCUE_MAX.toLocaleString('en-LK')}.`;
  }
  return null;
}

export function validateLkrRetailPrice(
  value: number | null,
  rescuePrice: number,
): string | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    return 'Enter a valid retail price.';
  }
  if (value > LKR_RETAIL_MAX) {
    return `Retail price cannot exceed Rs. ${LKR_RETAIL_MAX.toLocaleString('en-LK')}.`;
  }
  if (value > 0 && value < rescuePrice) {
    return 'Retail price should be at or above the rescue price.';
  }
  return null;
}

/** Peak hours in Sri Lanka local time (approx. lunch + evening rush). */
export function isPeakPublishHour(date = new Date()): boolean {
  const hour = date.getHours();
  return (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20);
}
