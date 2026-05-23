/**
 * Demo vs live data-mode helpers.
 *
 * `isDemoMode()` (from `@/config/demoMode`) is the single switch: release builds are
 * always live; dev builds may follow `.env` or the Profile → Developer override.
 *
 * Use `getAdminMetrics` for admin dashboard KPIs so screens do not duplicate
 * Supabase count queries and demo fixtures stay in one place.
 */
import type { AppEnv } from '@/config/env';
import { isDemoMode } from '@/config/demoMode';
import { CLOSED_COMPLAINT_STATUSES } from '@/lib/adminComplaints';
import { getSupabase } from '@/lib/supabase';

export { isDemoMode };

export type AdminMetrics = {
  ordersCount: number | null;
  profilesCount: number | null;
  todaysOrders: number | null;
  openComplaints: number | null;
  pendingMerchants: number | null;
  pendingSettlements: number | null;
  newMerchantsWeek: number | null;
};

const DEMO_ADMIN_METRICS: AdminMetrics = {
  ordersCount: 1284,
  profilesCount: 942,
  todaysOrders: 37,
  openComplaints: 3,
  pendingMerchants: 2,
  pendingSettlements: 1,
  newMerchantsWeek: 4,
};

/**
 * Admin home KPI block. In demo mode returns stable fixtures for design review;
 * otherwise runs the same head/count queries as `AdminHomeScreen`.
 */
export async function getAdminMetrics(env: AppEnv): Promise<AdminMetrics> {
  if (isDemoMode()) {
    return { ...DEMO_ADMIN_METRICS };
  }

  const sb = getSupabase(env);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const trendStart = new Date(startOfDay);
  trendStart.setDate(startOfDay.getDate() - 6);

  const [oc, pc, today, complaints, merchants, settlements, newMerchants] =
    await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString()),
      sb
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', `(${CLOSED_COMPLAINT_STATUSES.map((s) => `"${s}"`).join(',')})`),
      sb
        .from('merchants')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      sb
        .from('settlements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      sb
        .from('merchants')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', trendStart.toISOString()),
    ]);

  return {
    ordersCount: typeof oc.count === 'number' ? oc.count : null,
    profilesCount: typeof pc.count === 'number' ? pc.count : null,
    todaysOrders: typeof today.count === 'number' ? today.count : null,
    openComplaints: typeof complaints.count === 'number' ? complaints.count : null,
    pendingMerchants: typeof merchants.count === 'number' ? merchants.count : null,
    pendingSettlements:
      typeof settlements.count === 'number' ? settlements.count : null,
    newMerchantsWeek:
      typeof newMerchants.count === 'number' ? newMerchants.count : null,
  };
}
