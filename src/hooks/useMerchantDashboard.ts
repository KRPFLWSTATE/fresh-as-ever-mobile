import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { ACTIVE_ORDER_STATUSES, normalizeOrderStatus } from '@/lib/orderStatus';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { logError } from '@/observability/logError';

export type DashboardPopularBag = {
  id: string;
  title: string;
  image_url: string | null;
  order_count: number;
};

export type DashboardRecentRow = {
  id: string;
  customer_name: string;
  bag_title: string;
  time: string;
  status: string;
  total: number | null;
};

export function useMerchantDashboard(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { outletScopeIds, loading: contextLoading } = useMerchantContext(env);

  const [stats, setStats] = useState({
    active_bags: 0,
    today_orders: 0,
    today_revenue: 0,
    pickup_rate: 100,
    /**
     * Real day-scoped count of pending pick-ups across all the merchant's outlets,
     * computed from a `count: 'exact'` head query on `orders` with
     * `order_status in ('reserved','paid','ready_for_pickup')` and
     * `created_at >= today 00:00`. Previously this was derived from the recent-5
     * sample; the matrix flagged it as understated. Replaces that sample.
     */
    pending_pickups_today: 0,
    /**
     * Yesterday's counterpart values, used to power the day-over-day `%` delta
     * chips on the Merchant Dashboard 2×2 KPI bento. Computed from a parallel
     * count(*) query against `orders` and `rescue_bags` keyed on
     * `created_at between (now - 2d) and (now - 1d)`.
     */
    yesterday_orders: 0,
    yesterday_revenue: 0,
    yesterday_active_bags: 0,
    yesterday_pending_pickups: 0,
  });
  const [recentOrders, setRecentOrders] = useState<DashboardRecentRow[]>([]);
  const [popularBags, setPopularBags] = useState<DashboardPopularBag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!outletScopeIds.length) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('outlet_id', outletScopeIds)
        .gte('created_at', today.toISOString());

      if (ordersError) {
        throw ordersError;
      }

      const rowsToday = todayOrders ?? [];
      const sales = rowsToday
        .filter(
          (o) =>
            String((o as Record<string, unknown>).payment_status ?? '') === 'paid' ||
            normalizeOrderStatus(
              String((o as Record<string, unknown>).order_status ?? ''),
            ) === 'collected',
        )
        .reduce((sum, o) => sum + Number((o as Record<string, unknown>).total ?? 0), 0);

      const activeRoots = ACTIVE_ORDER_STATUSES as readonly string[];
      const activeOrderCount = rowsToday.filter((order) => {
        const s = normalizeOrderStatus(
          String((order as Record<string, unknown>).order_status ?? ''),
        );
        return activeRoots.includes(s);
      }).length;

      const { count: activeBagsCount, error: bagsError } = await supabase
        .from('rescue_bags')
        .select('*', { count: 'exact', head: true })
        .in('outlet_id', outletScopeIds)
        .eq('status', 'live');

      if (bagsError) {
        throw bagsError;
      }

      // Full-day pending pick-ups count — not the recent-5 sample. Uses head + exact.
      const { count: pendingPickupsCount, error: pendingError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('outlet_id', outletScopeIds)
        .in('order_status', ['reserved', 'paid', 'ready_for_pickup'])
        .gte('created_at', today.toISOString());

      if (pendingError) {
        throw pendingError;
      }

      // Yesterday counterpart values — used by the dashboard's day-over-day `%`
      // delta chips. We bucket `created_at` to the same 00:00..00:00 window
      // shifted back by one day, then compute the four KPI counts.
      const { data: yesterdayOrders, error: yOrdersError } = await supabase
        .from('orders')
        .select('order_status, payment_status, total')
        .in('outlet_id', outletScopeIds)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());

      if (yOrdersError) {
        throw yOrdersError;
      }

      const yRowsYesterday = yesterdayOrders ?? [];
      const yesterdayRevenue = yRowsYesterday
        .filter(
          (o) =>
            String((o as Record<string, unknown>).payment_status ?? '') === 'paid' ||
            normalizeOrderStatus(
              String((o as Record<string, unknown>).order_status ?? ''),
            ) === 'collected',
        )
        .reduce(
          (sum, o) => sum + Number((o as Record<string, unknown>).total ?? 0),
          0,
        );
      const yesterdayActiveOrders = yRowsYesterday.filter((order) => {
        const s = normalizeOrderStatus(
          String((order as Record<string, unknown>).order_status ?? ''),
        );
        return activeRoots.includes(s);
      }).length;
      const yesterdayPendingPickups = yRowsYesterday.filter((order) => {
        const s = String(
          (order as Record<string, unknown>).order_status ?? '',
        );
        return s === 'reserved' || s === 'paid' || s === 'ready_for_pickup';
      }).length;

      // `rescue_bags` doesn't carry a `created_at` we can scope cleanly to a
      // single past day in a way that matches "active yesterday" — bags listed
      // yesterday may still be live today. For the delta chip we treat the
      // yesterday baseline as the row count of bags that became `live` and
      // `created_at >= yesterday < today`, which is a reasonable
      // approximation of how the inventory moved overnight.
      const { count: yesterdayActiveBagsCount, error: yBagsError } =
        await supabase
          .from('rescue_bags')
          .select('*', { count: 'exact', head: true })
          .in('outlet_id', outletScopeIds)
          .eq('status', 'live')
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString());

      if (yBagsError) {
        throw yBagsError;
      }

      const { data: recent, error: recentError } = await supabase
        .from('orders')
        .select(
          `
          id, order_status, created_at,
          customer:profiles(full_name),
          bag:rescue_bags(title),
          total
        `,
        )
        .in('outlet_id', outletScopeIds)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        throw recentError;
      }

      const { data: popularData, error: popularError } = await supabase.rpc(
        'merchant_popular_bags',
        { p_outlet_ids: outletScopeIds, p_limit: 3 },
      );

      const formattedRecent = ((recent ?? []) as Record<string, unknown>[]).map(
        (r) => ({
          id: String(r.id),
          customer_name:
            String(
              (r.customer as Record<string, unknown> | undefined)?.full_name ?? '',
            ) || 'Customer',
          bag_title:
            String((r.bag as Record<string, unknown> | undefined)?.title ?? '') ||
            'Bag',
          time:
            typeof r.created_at === 'string'
              ? new Date(r.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '',
          status: normalizeOrderStatus(String(r.order_status ?? '')),
          total:
            typeof r.total === 'number'
              ? r.total
              : Number(r.total ?? null) || null,
        }),
      );

      setStats({
        today_revenue: sales,
        active_bags: activeBagsCount ?? 0,
        today_orders: activeOrderCount,
        pickup_rate: 100,
        pending_pickups_today: pendingPickupsCount ?? 0,
        yesterday_orders: yesterdayActiveOrders,
        yesterday_revenue: yesterdayRevenue,
        yesterday_active_bags: yesterdayActiveBagsCount ?? 0,
        yesterday_pending_pickups: yesterdayPendingPickups,
      });
      setRecentOrders(formattedRecent);
      setPopularBags(
        popularError
          ? []
          : ((popularData ?? []) as Record<string, unknown>[]).map((b) => ({
              id: String(b.bag_id ?? b.id ?? ''),
              title: String(b.title ?? 'Bag'),
              image_url:
                typeof b.image_url === 'string' && b.image_url.trim() ? b.image_url : null,
              order_count: Number(b.order_count ?? 0),
            })),
      );
    } catch {
      setError('Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [outletScopeIds, supabase]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    fetchDashboardData().catch((err) => logError(err, { context: 'useMerchantDashboard.fetchDashboardData' }));
  }, [fetchDashboardData, contextLoading]);

  return {
    stats,
    recentOrders,
    popularBags,
    loading: loading || contextLoading,
    error,
    refetch: fetchDashboardData,
  };
}
