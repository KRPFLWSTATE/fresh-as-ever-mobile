import { useCallback, useState } from 'react';
import { isDemoMode } from '@/config/demoMode';
import type { AppEnv } from '@/config/env';
import { buildDemoAdminOrderTrendRows } from '@/fixtures/demoAdminDashboard';
import { CLOSED_COMPLAINT_STATUSES } from '@/lib/adminComplaints';
import { getAdminMetrics } from '@/lib/dataMode';
import { getSupabase } from '@/lib/supabase';

export const ADMIN_DASHBOARD_TREND_DAYS = 7;
export const ADMIN_DASHBOARD_TREND_DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

export type AdminDashboardTrendBucket = {
  label: string;
  date: Date;
  count: number;
};

export type AdminDashboardRevenueBucket = {
  label: string;
  date: Date;
  amount: number;
};

export type AdminDashboardRecentEvent = {
  id: string;
  title: string;
  detail: string;
  kind: string;
  action: string;
  at: string | null;
};

const SETTLED_ORDER_STATUSES = new Set(['collected', 'completed']);

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketIndexForDate(trendStart: Date, when: Date, _dayCount: number): number {
  const startMs = startOfLocalDay(trendStart).getTime();
  const whenMs = startOfLocalDay(when).getTime();
  return Math.floor((whenMs - startMs) / (24 * 3600 * 1000));
}

export function useAdminDashboardMetrics(env: AppEnv) {
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [profilesCount, setProfilesCount] = useState<number | null>(null);
  const [todaysOrders, setTodaysOrders] = useState<number | null>(null);
  const [openComplaints, setOpenComplaints] = useState<number | null>(null);
  const [pendingMerchants, setPendingMerchants] = useState<number | null>(null);
  const [pendingSettlements, setPendingSettlements] = useState<number | null>(null);
  const [newMerchantsWeek, setNewMerchantsWeek] = useState<number | null>(null);
  const [recentEvents, setRecentEvents] = useState<AdminDashboardRecentEvent[]>([]);
  const [trend, setTrend] = useState<AdminDashboardTrendBucket[] | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<AdminDashboardRevenueBucket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendUsedDemoSeed, setTrendUsedDemoSeed] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const sb = getSupabase(env);
    const startOfDay = startOfLocalDay();
    const trendStart = new Date(startOfDay);
    trendStart.setDate(startOfDay.getDate() - (ADMIN_DASHBOARD_TREND_DAYS - 1));
    const demo = isDemoMode();

    if (demo) {
      const metrics = await getAdminMetrics(env);
      setOrdersCount(metrics.ordersCount);
      setProfilesCount(metrics.profilesCount);
      setTodaysOrders(metrics.todaysOrders);
      setOpenComplaints(metrics.openComplaints);
      setPendingMerchants(metrics.pendingMerchants);
      setPendingSettlements(metrics.pendingSettlements);
      setNewMerchantsWeek(metrics.newMerchantsWeek);
    }

    const [
      oc,
      pc,
      today,
      complaints,
      merchants,
      settlements,
      newMerchants,
      recent,
      trendRes,
      revenueRes,
    ] = await Promise.all([
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
      sb
        .from('audit_logs')
        .select('id, occurred_at, kind, action, title, detail')
        .order('occurred_at', { ascending: false })
        .limit(6),
      sb
        .from('orders')
        .select('created_at')
        .gte('created_at', trendStart.toISOString())
        .order('created_at', { ascending: true })
        .limit(2000),
      sb
        .from('orders')
        .select('created_at, collected_at, total, payment_status, order_status')
        .gte('created_at', trendStart.toISOString())
        .in('order_status', ['collected', 'completed'])
        .order('created_at', { ascending: true })
        .limit(2000),
    ]);

    if (!demo) {
      setOrdersCount(typeof oc.count === 'number' ? oc.count : null);
      setProfilesCount(typeof pc.count === 'number' ? pc.count : null);
      setTodaysOrders(typeof today.count === 'number' ? today.count : null);
      setOpenComplaints(typeof complaints.count === 'number' ? complaints.count : null);
      setPendingMerchants(typeof merchants.count === 'number' ? merchants.count : null);
      setPendingSettlements(typeof settlements.count === 'number' ? settlements.count : null);
      setNewMerchantsWeek(typeof newMerchants.count === 'number' ? newMerchants.count : null);
    }

    setRecentEvents(
      ((recent.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        detail: String(r.detail ?? ''),
        kind: String(r.kind ?? ''),
        action: String(r.action ?? ''),
        at: typeof r.occurred_at === 'string' ? (r.occurred_at as string) : null,
      })),
    );

    const buckets: AdminDashboardTrendBucket[] = [];
    const revenueBuckets: AdminDashboardRevenueBucket[] = [];
    for (let i = 0; i < ADMIN_DASHBOARD_TREND_DAYS; i++) {
      const d = new Date(trendStart);
      d.setDate(trendStart.getDate() + i);
      buckets.push({
        label: ADMIN_DASHBOARD_TREND_DAY_LABELS[d.getDay()],
        date: d,
        count: 0,
      });
      revenueBuckets.push({
        label: ADMIN_DASHBOARD_TREND_DAY_LABELS[d.getDay()],
        date: d,
        amount: 0,
      });
    }

    let trendRows = (trendRes.data ?? []) as Record<string, unknown>[];
    let revenueRows = (revenueRes.data ?? []) as Record<string, unknown>[];

    let usedDemoSeed = false;
    if (demo && trendRows.length === 0) {
      const seed = buildDemoAdminOrderTrendRows(trendStart, ADMIN_DASHBOARD_TREND_DAYS);
      trendRows = seed.map((r) => ({ created_at: r.created_at }));
      revenueRows = seed.map((r) => ({
        created_at: r.created_at,
        total: r.total ?? 0,
        order_status: 'collected',
      }));
      usedDemoSeed = true;
    }

    trendRows.forEach((r) => {
      const raw = r.created_at;
      if (typeof raw !== 'string') return;
      const when = new Date(raw);
      const idx = bucketIndexForDate(trendStart, when, ADMIN_DASHBOARD_TREND_DAYS);
      if (idx >= 0 && idx < ADMIN_DASHBOARD_TREND_DAYS) buckets[idx].count += 1;
    });

    revenueRows.forEach((r) => {
      const status = String(r.order_status ?? '');
      if (!SETTLED_ORDER_STATUSES.has(status)) return;
      const raw = r.collected_at ?? r.created_at;
      if (typeof raw !== 'string') return;
      const when = new Date(raw);
      const idx = bucketIndexForDate(trendStart, when, ADMIN_DASHBOARD_TREND_DAYS);
      if (idx < 0 || idx >= ADMIN_DASHBOARD_TREND_DAYS) return;
      const total = Number(r.total ?? 0);
      if (Number.isFinite(total)) revenueBuckets[idx].amount += total;
    });

    setTrend(buckets);
    setRevenueTrend(revenueBuckets);
    setTrendUsedDemoSeed(usedDemoSeed);
    setLoading(false);
  }, [env]);

  return {
    ordersCount,
    profilesCount,
    todaysOrders,
    openComplaints,
    pendingMerchants,
    pendingSettlements,
    newMerchantsWeek,
    recentEvents,
    trend,
    revenueTrend,
    loading,
    reload,
    /** True when demo seed filled an empty 7-day orders chart on the last reload. */
    trendUsesDemoSeed: trendUsedDemoSeed,
  };
}
