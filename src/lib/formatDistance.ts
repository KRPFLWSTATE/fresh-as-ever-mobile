/**
 * Format an outlet distance in kilometres to a Stitch-style label.
 * Examples:
 *   formatDistance(0.4)   -> '0.4km'
 *   formatDistance(3.214) -> '3.2km'
 *   formatDistance(NaN)   -> 'Near you'
 *   formatDistance(null)  -> 'Near you'
 *
 * Falls back to "Near you" whenever `km` is null/undefined/NaN — matches the Stitch
 * `discover_light_mode` "no geolocation yet" path.
 */
export function formatDistance(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km < 0) {
    return 'Near you';
  }
  const rounded = Math.round(km * 10) / 10;
  return `${rounded.toFixed(1)}km`;
}
