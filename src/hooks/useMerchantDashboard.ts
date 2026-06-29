import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { ACTIVE_ORDER_STATUSES, normalizeOrderStatus } from '@/lib/orderStatus';
import { filterOrdersForListingMode } from '@/lib/merchantOrderListingFilter';
import { orderDisplayTitle } from '@/lib/orderDisplay';
import { outletListingMode, type OutletListingMode } from '@/lib/outletListingMode';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { isPickupWindowOpen } from '@/domain/pickupWindow';
import { subscribeMerchantDataRevision } from '@/lib/merchantDataSync';
import { logError } from '@/observability/logError';
import { utcShelfDate } from '@/lib/utcShelfDate';

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
  const { outletScopeIds, outlets, activeOutlet, loading: contextLoading } = useMerchantContext(env);
  const listingMode = outletListingMode(
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : null,
  );
  const outletModeById = useMemo(() => {
    const map = new Map<string, OutletListingMode>();
    for (const outlet of outlets) {
      map.set(
        String(outlet.id),
        outletListingMode(
          typeof outlet.category === 'string' ? outlet.category : null,
        ),
      );
    }
    return map;
  }, [outlets]);

  const filterRowForOutletMode = useCallback(
    (row: { outlet_id?: unknown; shelf_id?: unknown }) => {
      const outletId = String(row.outlet_id ?? '');
      const mode = outletModeById.get(outletId) ?? 'rescue_bag';
      return filterOrdersForListingMode(
        [
          {
            shelf_id:
              row.shelf_id != null && String(row.shelf_id).length > 0
                ? String(row.shelf_id)
                : null,
          },
        ],
        mode,
      ).length > 0;
    },
    [outletModeById],
  );

  const [stats, setStats] = useState({
    active_bags: 0,
    today_orders: 0,
    today_revenue: 0,
    pickup_rate: 100,
    pending_pickups_today: 0,
    yesterday_orders: 0,
    yesterday_revenue: 0,
    yesterday_active_bags: 0,
    yesterday_pending_pickups: 0,
    /** Today's published shelf KPIs (supermarket / hybrid). */
    shelf_published_today: false,
    shelf_items_live: 0,
    shelf_items_sold_today: 0,
    shelf_revenue_today: 0,
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

      const { data: collectedTodayOrders, error: collectedTodayError } = await supabase
        .from('orders')
        .select('total, shelf_id, outlet_id, order_status, collected_at')
        .in('outlet_id', outletScopeIds)
        .gte('collected_at', today.toISOString())
        .in('order_status', ['collected', 'completed']);

      if (collectedTodayError) {
        throw collectedTodayError;
      }

      const rowsToday = (todayOrders ?? []).filter(filterRowForOutletMode);
      const collectedToday = (collectedTodayOrders ?? []).filter(filterRowForOutletMode);
      const sales = collectedToday.reduce(
        (sum, o) => sum + Number((o as Record<string, unknown>).total ?? 0),
        0,
      );

      const activeRoots = ACTIVE_ORDER_STATUSES as readonly string[];
      const activeOrderCount = rowsToday.filter((order) => {
        const s = normalizeOrderStatus(
          String((order as Record<string, unknown>).order_status ?? ''),
        );
        return activeRoots.includes(s);
      }).length;

      let activeBagsCount = 0;
      const todayDate = utcShelfDate();
      const listingOutletIds = activeOutlet?.id
        ? [String(activeOutlet.id)]
        : outletScopeIds;

      if (listingMode === 'clearance_shelf') {
        const { data: todayShelves, error: shelfListError } = await supabase
          .from('clearance_shelves')
          .select('id')
          .in('outlet_id', listingOutletIds)
          .eq('shelf_date', todayDate)
          .eq('status', 'published');
        if (shelfListError) {
          throw shelfListError;
        }
        const shelfIds = (todayShelves ?? []).map((s) => String(s.id));
        if (shelfIds.length > 0) {
          const { data: shelfItemRows, error: itemCountError } = await supabase
            .from('clearance_shelf_items')
            .select('quantity_remaining, status')
            .in('shelf_id', shelfIds);
          if (itemCountError) {
            throw itemCountError;
          }
          activeBagsCount = (shelfItemRows ?? []).reduce((sum, row) => {
            if (String((row as Record<string, unknown>).status ?? '') === 'removed') {
              return sum;
            }
            return sum + Math.max(0, Number((row as Record<string, unknown>).quantity_remaining ?? 0));
          }, 0);
        }
      } else if (listingMode === 'hybrid') {
        const { count: bagCount, error: bagsError } = await supabase
          .from('rescue_bags')
          .select('*', { count: 'exact', head: true })
          .in('outlet_id', listingOutletIds)
          .eq('status', 'live');
        if (bagsError) {
          throw bagsError;
        }
        let shelfItemCount = 0;
        const { data: todayShelves, error: shelfListError } = await supabase
          .from('clearance_shelves')
          .select('id')
          .in('outlet_id', listingOutletIds)
          .eq('shelf_date', todayDate)
          .eq('status', 'published');
        if (shelfListError) {
          throw shelfListError;
        }
        const shelfIds = (todayShelves ?? []).map((s) => String(s.id));
        if (shelfIds.length > 0) {
          const { count, error: itemCountError } = await supabase
            .from('clearance_shelf_items')
            .select('*', { count: 'exact', head: true })
            .in('shelf_id', shelfIds);
          if (itemCountError) {
            throw itemCountError;
          }
          shelfItemCount = count ?? 0;
        }
        activeBagsCount = (bagCount ?? 0) + shelfItemCount;
      } else {
        const { count, error: bagsError } = await supabase
          .from('rescue_bags')
          .select('*', { count: 'exact', head: true })
          .in('outlet_id', listingOutletIds)
          .eq('status', 'live');
        if (bagsError) {
          throw bagsError;
        }
        activeBagsCount = count ?? 0;
      }

      const { data: pendingRows, error: pendingError } = await supabase
        .from('orders')
        .select(`
          outlet_id, shelf_id, bag_id, order_status,
          shelf:clearance_shelves(pickup_start, pickup_end),
          bag:rescue_bags(pickup_start, pickup_end)
        `)
        .in('outlet_id', outletScopeIds)
        .in('order_status', ['reserved', 'paid', 'ready_for_pickup']);

      if (pendingError) {
        throw pendingError;
      }

      const nowMs = Date.now();
      const pendingPickupsCount =
        (pendingRows ?? []).filter((row) => {
          if (!filterRowForOutletMode(row)) return false;
          const rec = row as Record<string, unknown>;
          const shelf = rec.shelf as Record<string, unknown> | null | undefined;
          const bag = rec.bag as Record<string, unknown> | null | undefined;
          const pickupStart =
            (typeof shelf?.pickup_start === 'string' ? shelf.pickup_start : null) ??
            (typeof bag?.pickup_start === 'string' ? bag.pickup_start : null);
          const pickupEnd =
            (typeof shelf?.pickup_end === 'string' ? shelf.pickup_end : null) ??
            (typeof bag?.pickup_end === 'string' ? bag.pickup_end : null);
          if (!pickupEnd) return true;
          return (
            isPickupWindowOpen(nowMs, pickupStart, pickupEnd) ||
            new Date(pickupEnd).getTime() >= nowMs
          );
        }).length ?? 0;

      // Yesterday counterpart values — used by the dashboard's day-over-day `%`
      // delta chips. We bucket `created_at` to the same 00:00..00:00 window
      // shifted back by one day, then compute the four KPI counts.
      const { data: yesterdayCollected, error: yCollectedError } = await supabase
        .from('orders')
        .select('total, shelf_id, outlet_id, order_status, collected_at')
        .in('outlet_id', outletScopeIds)
        .gte('collected_at', yesterday.toISOString())
        .lt('collected_at', today.toISOString())
        .in('order_status', ['collected', 'completed']);

      if (yCollectedError) {
        throw yCollectedError;
      }

      const { data: yesterdayOrders, error: yOrdersError } = await supabase
        .from('orders')
        .select('order_status, payment_status, total, shelf_id, outlet_id')
        .in('outlet_id', outletScopeIds)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());

      if (yOrdersError) {
        throw yOrdersError;
      }

      const yRowsYesterday = (yesterdayOrders ?? []).filter(filterRowForOutletMode);
      const yesterdayRevenue = (yesterdayCollected ?? [])
        .filter(filterRowForOutletMode)
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
      const { data: yPendingRows, error: yPendingErr } = await supabase
        .from('orders')
        .select(`
          outlet_id, shelf_id, bag_id, order_status,
          shelf:clearance_shelves(pickup_start, pickup_end),
          bag:rescue_bags(pickup_start, pickup_end)
        `)
        .in('outlet_id', outletScopeIds)
        .in('order_status', ['reserved', 'paid', 'ready_for_pickup'])
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());
      if (yPendingErr) throw yPendingErr;
      const yPendingMs = yesterday.getTime() + 12 * 60 * 60 * 1000;
      const yesterdayPendingPickups = (yPendingRows ?? []).filter((row) => {
        if (!filterRowForOutletMode(row)) return false;
        const rec = row as Record<string, unknown>;
        const shelf = rec.shelf as Record<string, unknown> | null | undefined;
        const bag = rec.bag as Record<string, unknown> | null | undefined;
        const pickupEnd =
          (typeof shelf?.pickup_end === 'string' ? shelf.pickup_end : null) ??
          (typeof bag?.pickup_end === 'string' ? bag.pickup_end : null);
        if (!pickupEnd) return true;
        return new Date(pickupEnd).getTime() >= yPendingMs;
      }).length;

      // `rescue_bags` doesn't carry a `created_at` we can scope cleanly to a
      // single past day in a way that matches "active yesterday" — bags listed
      // yesterday may still be live today. For the delta chip we treat the
      // yesterday baseline as the row count of bags that became `live` and
      // `created_at >= yesterday < today`, which is a reasonable
      // approximation of how the inventory moved overnight.
      let yesterdayActiveBagsCount = 0;
      if (listingMode === 'clearance_shelf') {
        const yDate = utcShelfDate(yesterday);
        const { data: yShelves, error: yShelfErr } = await supabase
          .from('clearance_shelves')
          .select('id')
          .in('outlet_id', listingOutletIds)
          .eq('shelf_date', yDate)
          .eq('status', 'published');
        if (yShelfErr) throw yShelfErr;
        const yShelfIds = (yShelves ?? []).map((s) => String(s.id));
        if (yShelfIds.length > 0) {
          const { count, error: yItemErr } = await supabase
            .from('clearance_shelf_items')
            .select('*', { count: 'exact', head: true })
            .in('shelf_id', yShelfIds);
          if (yItemErr) throw yItemErr;
          yesterdayActiveBagsCount = count ?? 0;
        }
      } else {
        const { count, error: yBagsError } = await supabase
          .from('rescue_bags')
          .select('*', { count: 'exact', head: true })
          .in('outlet_id', listingOutletIds)
          .eq('status', 'live')
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString());
        if (yBagsError) throw yBagsError;
        yesterdayActiveBagsCount = count ?? 0;
      }

      const { data: recent, error: recentError } = await supabase
        .from('orders')
        .select(
          `
          id, order_status, created_at, updated_at, shelf_id, outlet_id,
          customer:profiles(full_name),
          bag:rescue_bags(title),
          order_items(name_snapshot, quantity),
          total
        `,
        )
        .in('outlet_id', outletScopeIds)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentError) {
        throw recentError;
      }

      const filteredRecent = (recent ?? []).filter(filterRowForOutletMode).slice(0, 5);

      let popularData: Record<string, unknown>[] | null = null;
      let popularError: Error | null = null;
      if (listingMode !== 'clearance_shelf') {
        const popularResult = await supabase.rpc('merchant_popular_bags', {
          p_outlet_ids: outletScopeIds,
          p_limit: 3,
        });
        popularData = (popularResult.data ?? []) as Record<string, unknown>[];
        popularError = popularResult.error;
      }

      const formattedRecent = (filteredRecent as Record<string, unknown>[]).map(
        (r) => {
          const bagObj = r.bag as Record<string, unknown> | undefined;
          const orderItems = Array.isArray(r.order_items)
            ? (r.order_items as Record<string, unknown>[])
            : [];
          const shelfId =
            r.shelf_id != null && String(r.shelf_id).length > 0
              ? String(r.shelf_id)
              : null;
          return {
            id: String(r.id),
            customer_name:
              String(
                (r.customer as Record<string, unknown> | undefined)?.full_name ?? '',
              ) || 'Customer',
            bag_title: orderDisplayTitle({
              shelf_id: shelfId,
              bag: bagObj
                ? { title: typeof bagObj.title === 'string' ? bagObj.title : null }
                : null,
              order_items: orderItems.map((item) => ({
                name_snapshot:
                  typeof item.name_snapshot === 'string' ? item.name_snapshot : null,
                quantity: typeof item.quantity === 'number' ? item.quantity : null,
              })),
            }),
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
          };
        },
      );

      let shelfPublishedToday = false;
      let shelfItemsLive = 0;
      let shelfItemsSoldToday = 0;
      let shelfRevenueToday = 0;

      if (listingMode === 'clearance_shelf' || listingMode === 'hybrid') {
        const shelfOutletId = activeOutlet?.id
          ? String(activeOutlet.id)
          : listingOutletIds[0];
        const { data: todayShelfRows, error: todayShelfErr } = await supabase
          .from('clearance_shelves')
          .select('id, status, items:clearance_shelf_items(quantity_total, quantity_remaining, status)')
          .eq('outlet_id', shelfOutletId)
          .eq('shelf_date', todayDate)
          .maybeSingle();
        if (todayShelfErr) throw todayShelfErr;
        if (todayShelfRows) {
          shelfPublishedToday =
            String(todayShelfRows.status ?? '').toLowerCase() === 'published';
          const shelfItems = (todayShelfRows.items ?? []) as Record<string, unknown>[];
          for (const item of shelfItems) {
            if (String(item.status ?? '').toLowerCase() === 'removed') continue;
            const remaining = Number(item.quantity_remaining ?? 0);
            const total = Number(item.quantity_total ?? 0);
            if (remaining > 0) shelfItemsLive += remaining;
            shelfItemsSoldToday += Math.max(0, total - remaining);
          }
        }
        shelfRevenueToday = collectedToday
          .filter((o) => {
            const sid = (o as Record<string, unknown>).shelf_id;
            return sid != null && String(sid).length > 0;
          })
          .reduce((sum, o) => sum + Number((o as Record<string, unknown>).total ?? 0), 0);
      }

      setStats({
        today_revenue: sales,
        active_bags: activeBagsCount,
        today_orders: activeOrderCount,
        pickup_rate: 100,
        pending_pickups_today: pendingPickupsCount ?? 0,
        yesterday_orders: yesterdayActiveOrders,
        yesterday_revenue: yesterdayRevenue,
        yesterday_active_bags: yesterdayActiveBagsCount,
        yesterday_pending_pickups: yesterdayPendingPickups,
        shelf_published_today: shelfPublishedToday,
        shelf_items_live: shelfItemsLive,
        shelf_items_sold_today: shelfItemsSoldToday,
        shelf_revenue_today: shelfRevenueToday,
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
  }, [outletScopeIds, supabase, listingMode, filterRowForOutletMode, activeOutlet?.id]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    fetchDashboardData().catch((err) => logError(err, { context: 'useMerchantDashboard.fetchDashboardData' }));
  }, [fetchDashboardData, contextLoading]);

  useEffect(() => {
    return subscribeMerchantDataRevision(() => {
      fetchDashboardData().catch((err) =>
        logError(err, { context: 'useMerchantDashboard.revisionRefetch' }),
      );
    });
  }, [fetchDashboardData]);

  return {
    stats,
    recentOrders,
    popularBags,
    loading: loading || contextLoading,
    error,
    refetch: fetchDashboardData,
  };
}
