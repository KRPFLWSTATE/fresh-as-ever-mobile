/** UTC calendar date for `clearance_shelves.shelf_date` (YYYY-MM-DD). */
export function utcShelfDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
