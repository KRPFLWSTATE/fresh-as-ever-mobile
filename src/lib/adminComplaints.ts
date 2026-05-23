/** Shared open-complaint predicate for admin dashboard, lists, and merchant detail. */

export const CLOSED_COMPLAINT_STATUSES = ['resolved', 'closed', 'dismissed'] as const;

export function isOpenComplaintStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s.length > 0 && !CLOSED_COMPLAINT_STATUSES.includes(s as (typeof CLOSED_COMPLAINT_STATUSES)[number]);
}
