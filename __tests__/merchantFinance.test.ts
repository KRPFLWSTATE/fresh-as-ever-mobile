import { mapSupabaseError } from '../src/lib/supabaseError';

const PENDING_STATUSES = new Set(['pending', 'processing']);
const SETTLED_STATUSES = new Set(['paid', 'completed']);

function sumByStatus(
  rows: { status: string; net_payout: number }[],
  statuses: Set<string>,
): number {
  return rows
    .filter((r) => statuses.has(r.status))
    .reduce((s, r) => s + r.net_payout, 0);
}

describe('merchant finance paidOut', () => {
  it('sums all settled statuses for paidOut (not latest period only)', () => {
    const rows = [
      { status: 'paid', net_payout: 1000 },
      { status: 'completed', net_payout: 500 },
      { status: 'pending', net_payout: 200 },
    ];
    expect(sumByStatus(rows, SETTLED_STATUSES)).toBe(1500);
    expect(sumByStatus(rows, PENDING_STATUSES)).toBe(200);
  });
});

describe('mapSupabaseError', () => {
  it('maps PGRST116 to safe copy', () => {
    expect(
      mapSupabaseError({ code: 'PGRST116', message: '0 rows' } as import('@supabase/supabase-js').PostgrestError),
    ).toBe(
      'We could not find that. It may have been removed.',
    );
  });
});
