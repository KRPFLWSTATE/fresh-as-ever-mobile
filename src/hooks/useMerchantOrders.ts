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
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';
import { mapHandoverError } from '@/lib/messages/rpc';
import { ERROR } from '@/lib/messages/errors';

export type { MerchantOrdersView } from '@/domain/merchantOrdersView';

export { filterOrdersByViewDomain as filterOrdersByView };

export type MerchantOrderRow = {
  id: string;
  reservation_code: string | null;
  status: string;
  order_status_raw: string | null;
  payment_status: string | null;
  customer_name: string;
  customer_phone: string | null;
  bag_title: string;
  bag_image_url: string | null;
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

export function useMerchantOrders(
  env: AppEnv,
  view: MerchantOrdersView = 'all',
) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { outletScopeIds, loading: contextLoading } = useMerchantContext(env);

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
          customer:profiles(full_name, phone),
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
        const pickupEnd =
          typeof bagObj?.pickup_end === 'string'
            ? String(bagObj.pickup_end)
            : null;
        const pickupStart =
          typeof bagObj?.pickup_start === 'string'
            ? String(bagObj.pickup_start)
            : null;
        const bagImage =
          typeof bagObj?.image_url === 'string' ? String(bagObj.image_url) : null;
        const paymentStatus =
          typeof o.payment_status === 'string' ? o.payment_status : null;

        const row: MerchantOrderRow = {
          id: String(o.id),
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
          bag_title:
            String(
              (o.bag as Record<string, unknown> | undefined)?.title ?? '',
            ) || 'Rescue bag',
          bag_image_url: bagImage,
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

      setOrders(formatted);
    } catch (e) {
      logSupabaseError(e, 'useMerchantOrders.fetchOrders');
      setError(mapSupabaseError(e as Error, 'Could not load orders right now. Pull to retry.'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [outletScopeIds, supabase]);

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
      const { data, error: rpcError } = await supabase.rpc('merchant_collect_order', {
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

      const { data, error: lookupError } = await supabase
        .from('orders')
        .select('id, order_status, payment_status, outlet_id')
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
    [outletScopeIds, supabase, collectOrder],
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
    manualVerifyOrder,
    authorizeHandoverByCode,
    markNoShow,
  };
}
