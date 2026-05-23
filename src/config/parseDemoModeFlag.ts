/**
 * Returns true only when the raw env value is exactly the string `true` after trim.
 * Unset, `false`, `1`, `TRUE`, `yes`, etc. → false.
 */
export function parseDemoModeFlag(value: unknown): boolean {
  return String(value ?? '').trim() === 'true';
}
