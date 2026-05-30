import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import {
  ACTIVE_ORDER_STATUSES,
  isOrderEligibleForMerchantNoShow,
  normalizeOrderStatus,
} from '@/lib/orderStatus';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import type { MerchantOrdersView } from '@/domain/merchantOrdersView';
import {
  filterOrdersByView as filterOrdersByViewDomain,
  isOrderCollectible,
} from '@/domain/merchantOrderFilters';
import { filterOrdersForListingMode } from '@/lib/merchantOrderListingFilter';
import { orderDisplayTitle, orderPickupWindow } from '@/lib/orderDisplay';
import { outletListingMode, type OutletListingMode } from '@/lib/outletListingMode';
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';
import { mapHandoverError } from '@/lib/messages/rpc';
import { ERROR } from '@/lib/messages/errors';

export type { MerchantOrdersView } from '@/domain/merchantOrdersView';

export { filterOrdersByViewDomain as filterOrdersByView };

export type MerchantOrderRow = {
  id: string;
  outlet_id: string;
  reservation_code: string | null;
  status: string;
  order_status_raw: string | null;
  payment_status: string | null;
  customer_name: string;
  customer_phone: string | null;
  bag_title: string;
  bag_image_url: string | null;
  shelf_id: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  no_show_available: boolean;
  total: number | null;
  created_at: string;
  customer_arrived_at: string | null;
};

export const MERCHANT_ORDERS_VIEW_LABELS: Record<
  MerchantOrdersView,
  { title: string; subtitle: string }
> = {
  all: { title: 'Active orders', subtitle: 'All open pickups' },
  verification: {
    title: 'Orders verification',
    subtitle: 'Ready for handover now',
  },
  'review-pending': {
    title: 'Review pending',
    subtitle: 'Scheduled / awaiting payment',
  },
  'late-pickups': {
    title: 'Late pickups',
    subtitle: 'Past pickup window',
  },
  'live-monitor': {
    title: 'Live monitor',
    subtitle: 'Ending in the next 2 hours',
  },
};

export type HandoverLookupResult =
  | {
      type: 'group';
      groupId: string;
      code: string;
      bagCount: number;
      bags: { id: string; title: string }[];
      customerName: string;
    }
  | {
      type: 'order';
      orderId: string;
      code: string;
      bagTitle: string;
      customerName: string;
    }
  | {
      type: 'clearance';
      orderId: string;
      code: string;
      items: Record<string, unknown>[];
      customerName: string;
    }
  | { error: string };

export function useMerchantOrders(
  env: AppEnv,
  view: MerchantOrdersView = 'all',
) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { outletScopeIds, outlets, loading: contextLoading } = useMerchantContext(env);
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

  const [orders, setOrders] = useState<MerchantOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!outletScopeIds.length) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activeList = [...ACTIVE_ORDER_STATUSES, 'awaiting_pickup'] as string[];

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(
          `
          id,
          created_at,
          order_status,
          payment_status,
          total,
          reservation_code,
          customer_arrived_at,
          outlet_id,
          shelf_id,
          customer:profiles(full_name, phone),
          order_items(name_snapshot, quantity),
          shelf:clearance_shelves(pickup_start, pickup_end),
          bag:rescue_bags(title, image_url, pickup_start, pickup_end)
        `,
        )
        .in('outlet_id', outletScopeIds)
        .in('order_status', activeList)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const formatted = ((data ?? []) as Record<string, unknown>[]).map((o) => {
        const status = normalizeOrderStatus(String(o.order_status ?? ''));
        const bagObj = o.bag as Record<string, unknown> | undefined;
        const shelfObj = o.shelf as Record<string, unknown> | undefined;
        const orderItems = Array.isArray(o.order_items)
          ? (o.order_items as Record<string, unknown>[])
          : [];
        const shelfId =
          o.shelf_id != null && String(o.shelf_id).length > 0
            ? String(o.shelf_id)
            : null;
        const pickup = orderPickupWindow({
          shelf_id: shelfId,
          bag: bagObj
            ? {
                pickup_start:
                  typeof bagObj.pickup_start === 'string' ? bagObj.pickup_start : null,
                pickup_end:
                  typeof bagObj.pickup_end === 'string' ? bagObj.pickup_end : null,
              }
            : null,
          shelf: shelfObj
            ? {
                pickup_start:
                  typeof shelfObj.pickup_start === 'string'
                    ? shelfObj.pickup_start
                    : null,
                pickup_end:
                  typeof shelfObj.pickup_end === 'string' ? shelfObj.pickup_end : null,
              }
            : null,
        });
        const pickupEnd = pickup.end;
        const pickupStart = pickup.start;
        const bagImage =
          typeof bagObj?.image_url === 'string' ? String(bagObj.image_url) : null;
        const paymentStatus =
          typeof o.payment_status === 'string' ? o.payment_status : null;
        const displayTitle = orderDisplayTitle({
          shelf_id: shelfId,
          bag: bagObj ? { title: typeof bagObj.title === 'string' ? bagObj.title : null } : null,
          order_items: orderItems.map((item) => ({
            name_snapshot:
              typeof item.name_snapshot === 'string' ? item.name_snapshot : null,
            quantity: typeof item.quantity === 'number' ? item.quantity : null,
          })),
        });

        const row: MerchantOrderRow = {
          id: String(o.id),
          outlet_id: String(o.outlet_id ?? ''),
          reservation_code:
            typeof o.reservation_code === 'string' ? o.reservation_code : null,
          status,
          order_status_raw:
            typeof o.order_status === 'string' ? o.order_status : null,
          payment_status: paymentStatus,
          customer_name:
            String(
              (o.customer as Record<string, unknown> | undefined)?.full_name ??
                '',
            ) || 'Customer',
          customer_phone: (() => {
            const v = (o.customer as Record<string, unknown> | undefined)?.phone;
            return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
          })(),
          bag_title: displayTitle,
          bag_image_url: bagImage,
          shelf_id: shelfId,
          pickup_start: pickupStart,
          pickup_end: pickupEnd,
          no_show_available: isOrderEligibleForMerchantNoShow(status, pickupEnd),
          total:
            typeof o.total === 'number'
              ? o.total
              : Number(o.total ?? null) || null,
          created_at:
            typeof o.created_at === 'string'
              ? o.created_at
              : String(o.created_at ?? ''),
          customer_arrived_at:
            typeof o.customer_arrived_at === 'string'
              ? o.customer_arrived_at
              : null,
        };
        return row;
      });

      setOrders(
        formatted.filter((order) => {
          const mode = outletModeById.get(order.outlet_id) ?? 'rescue_bag';
          return filterOrdersForListingMode([order], mode).length > 0;
        }),
      );
    } catch (e) {
      logSupabaseError(e, 'useMerchantOrders.fetchOrders');
      setError(mapSupabaseError(e as Error, 'Could not load orders right now. Pull to retry.'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [outletScopeIds, supabase, outletModeById]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    fetchOrders().catch((err) => logError(err, { context: 'useMerchantOrders.fetchOrders' }));
  }, [fetchOrders, contextLoading]);

  const visibleOrders = useMemo(
    () => filterOrdersByViewDomain(orders, view),
    [orders, view],
  );

  const collectOrder = useCallback(
    async (orderId: string, code?: string | null): Promise<{ error?: string }> => {
      const { data: orderMeta } = await supabase
        .from('orders')
        .select('shelf_id')
        .eq('id', orderId)
        .maybeSingle();
      const rpcName =
        orderMeta?.shelf_id != null
          ? 'merchant_collect_clearance_order'
          : 'merchant_collect_order';
      const { data, error: rpcError } = await supabase.rpc(rpcName, {
        p_order_id: orderId,
        p_code: code?.trim() ? code.replace(/\s/g, '').toUpperCase() : null,
      });

      if (rpcError) {
        return {
          error: mapHandoverError(rpcError.message, ERROR.handover.failed),
        };
      }
      if (data && typeof data === 'object' && 'ok' in (data as object) && !(data as { ok?: boolean }).ok) {
        return { error: 'Handover was not completed.' };
      }
      await fetchOrders();
      return {};
    },
    [supabase, fetchOrders],
  );

  const collectGroupHandover = useCallback(
    async (groupId: string, code?: string | null): Promise<{ error?: string }> => {
      const { error: rpcError } = await supabase.rpc('merchant_collect_group', {
        p_group_id: groupId,
        p_code: code?.trim() ? code.replace(/\s/g, '').toUpperCase() : null,
      });
      if (rpcError) {
        return {
          error: mapSupabaseError(rpcError, 'Could not complete group handover.'),
        };
      }
      await fetchOrders();
      return {};
    },
    [supabase, fetchOrders],
  );

  const lookupHandoverByCode = useCallback(
    async (rawCode: string): Promise<HandoverLookupResult> => {
      const code = rawCode.replace(/\s/g, '').toUpperCase();
      if (code.length !== 6) {
        return { error: ERROR.handover.codeLength };
      }
      if (!outletScopeIds.length) {
        return { error: 'No outlet selected.' };
      }

      const { data: group, error: groupLookupError } = await supabase
        .from('reservation_groups')
        .select('id, order_status, payment_status, outlet_id, bag_count, reservation_code')
        .eq('reservation_code', code)
        .maybeSingle();

      if (groupLookupError) {
        return { error: mapSupabaseError(groupLookupError, ERROR.common.notFound) };
      }

      if (group && typeof group.id === 'string') {
        if (!outletScopeIds.includes(String(group.outlet_id))) {
          return { error: 'This pickup is not for your outlets.' };
        }
        const { data: childOrders, error: childErr } = await supabase
          .from('orders')
          .select('id, bag:rescue_bags(title), customer:profiles(full_name)')
          .eq('group_id', group.id)
          .order('created_at', { ascending: true });
        if (childErr) {
          return { error: mapSupabaseError(childErr, ERROR.common.notFound) };
        }
        const rows = (childOrders ?? []) as Record<string, unknown>[];
        const bags = rows.map((row) => ({
          id: String(row.id),
          title: String((row.bag as { title?: string } | undefined)?.title ?? 'Bag'),
        }));
        const customerName =
          String(
            (rows[0]?.customer as { full_name?: string } | undefined)?.full_name ?? '',
          ) || 'Customer';
        return {
          type: 'group',
          groupId: group.id,
          code,
          bagCount: typeof group.bag_count === 'number' ? group.bag_count : bags.length,
          bags,
          customerName,
        };
      }

      const { data, error: lookupError } = await supabase
        .from('orders')
        .select(`
          id, order_status, payment_status, outlet_id, group_id, shelf_id, reservation_code,
          bag:rescue_bags(title),
          customer:profiles(full_name)
        `)
        .eq('reservation_code', code)
        .maybeSingle();

      if (lookupError) {
        return { error: mapSupabaseError(lookupError, ERROR.common.notFound) };
      }
      if (!data || typeof data.id !== 'string') {
        return { error: 'No order found for this code.' };
      }
      if (!outletScopeIds.includes(String(data.outlet_id))) {
        return { error: 'This pickup is not for your outlets.' };
      }

      if (data.shelf_id) {
        const { data: lineItems, error: itemsErr } = await supabase
          .from('order_items')
          .select('id, name_snapshot, image_url_snapshot, quantity, line_total')
          .eq('order_id', data.id)
          .order('created_at', { ascending: true });
        if (itemsErr) {
          return { error: mapSupabaseError(itemsErr, ERROR.common.notFound) };
        }
        const row: MerchantOrderRow = {
          id: data.id,
          status: normalizeOrderStatus(String(data.order_status ?? '')),
          order_status_raw: String(data.order_status ?? ''),
          payment_status:
            typeof data.payment_status === 'string' ? data.payment_status : null,
        } as MerchantOrderRow;
        if (!isOrderCollectible(row)) {
          return { error: ERROR.handover.notReady };
        }
        return {
          type: 'clearance',
          orderId: data.id,
          code,
          items: lineItems ?? [],
          customerName:
            String(
              (data.customer as { full_name?: string } | undefined)?.full_name ?? '',
            ) || 'Customer',
        };
      }

      if (data.group_id && typeof data.group_id === 'string') {
        const { data: childOrders, error: childErr } = await supabase
          .from('orders')
          .select('id, bag:rescue_bags(title), customer:profiles(full_name)')
          .eq('group_id', data.group_id)
          .order('created_at', { ascending: true });
        if (childErr) {
          return { error: mapSupabaseError(childErr, ERROR.common.notFound) };
        }
        const rows = (childOrders ?? []) as Record<string, unknown>[];
        const bags = rows.map((row) => ({
          id: String(row.id),
          title: String((row.bag as { title?: string } | undefined)?.title ?? 'Bag'),
        }));
        return {
          type: 'group',
          groupId: data.group_id,
          code,
          bagCount: bags.length,
          bags,
          customerName:
            String(
              (data.customer as { full_name?: string } | undefined)?.full_name ?? '',
            ) || 'Customer',
        };
      }

      const row: MerchantOrderRow = {
        id: data.id,
        status: normalizeOrderStatus(String(data.order_status ?? '')),
        order_status_raw: String(data.order_status ?? ''),
        payment_status:
          typeof data.payment_status === 'string' ? data.payment_status : null,
      } as MerchantOrderRow;

      if (!isOrderCollectible(row)) {
        return { error: ERROR.handover.notReady };
      }

      return {
        type: 'order',
        orderId: data.id,
        code,
        bagTitle: String((data.bag as { title?: string } | undefined)?.title ?? 'Bag'),
        customerName:
          String(
            (data.customer as { full_name?: string } | undefined)?.full_name ?? '',
          ) || 'Customer',
      };
    },
    [outletScopeIds, supabase],
  );

  const manualVerifyOrder = useCallback(
    async (orderId: string): Promise<{ error?: string }> => collectOrder(orderId, null),
    [collectOrder],
  );

  const authorizeHandoverByCode = useCallback(
    async (rawCode: string): Promise<{ error?: string }> => {
      const code = rawCode.replace(/\s/g, '').toUpperCase();
      if (code.length !== 6) {
        return { error: ERROR.handover.codeLength };
      }
      if (!outletScopeIds.length) {
        return { error: 'No outlet selected.' };
      }

      const { data: group, error: groupLookupError } = await supabase
        .from('reservation_groups')
        .select('id, order_status, payment_status, outlet_id, bag_count')
        .eq('reservation_code', code)
        .maybeSingle();

      if (groupLookupError) {
        return { error: mapSupabaseError(groupLookupError, ERROR.common.notFound) };
      }

      if (group && typeof group.id === 'string') {
        if (!outletScopeIds.includes(String(group.outlet_id))) {
          return { error: 'This pickup is not for your outlets.' };
        }
        return collectGroupHandover(group.id, code);
      }

      const { data, error: lookupError } = await supabase
        .from('orders')
        .select('id, order_status, payment_status, outlet_id, group_id')
        .eq('reservation_code', code)
        .maybeSingle();

      if (lookupError) {
        return { error: mapSupabaseError(lookupError, ERROR.common.notFound) };
      }
      if (!data || typeof data.id !== 'string') {
        return { error: 'No order found for this code.' };
      }
      if (!outletScopeIds.includes(String(data.outlet_id))) {
        return { error: 'This pickup is not for your outlets.' };
      }

      if (data.group_id) {
        return collectGroupHandover(String(data.group_id), code);
      }

      const row: MerchantOrderRow = {
        id: data.id,
        status: normalizeOrderStatus(String(data.order_status ?? '')),
        order_status_raw: String(data.order_status ?? ''),
        payment_status:
          typeof data.payment_status === 'string' ? data.payment_status : null,
      } as MerchantOrderRow;

      if (!isOrderCollectible(row)) {
        return { error: ERROR.handover.notReady };
      }

      return collectOrder(data.id, code);
    },
    [outletScopeIds, supabase, collectOrder, collectGroupHandover],
  );

  const markNoShow = useCallback(
    async (orderId: string): Promise<{ error?: string }> => {
      const { error: rpcError } = await supabase.rpc('mark_order_no_show', {
        p_order_id: orderId,
      });

      if (rpcError) {
        let msg =
          rpcError.message ||
          (typeof rpcError === 'object' && 'details' in rpcError
            ? String((rpcError as { details?: string }).details)
            : '');
        msg = msg || 'Could not report no-show.';
        if (msg.includes('grace')) {
          msg = 'Available 30 minutes after pickup window closes.';
        }
        return { error: msg };
      }
      await fetchOrders();
      return {};
    },
    [supabase, fetchOrders],
  );

  return {
    orders,
    visibleOrders,
    loading: loading || contextLoading,
    error,
    refetch: fetchOrders,
    collectOrder,
    collectGroupHandover,
    lookupHandoverByCode,
    manualVerifyOrder,
    authorizeHandoverByCode,
    markNoShow,
  };
}
