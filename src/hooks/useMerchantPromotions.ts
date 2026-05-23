import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type PromoStatus = 'active' | 'scheduled' | 'expired';

export type PromoRow = {
  id: string;
  title: string;
  status: PromoStatus;
  discount_label: string;
  max_uses: number | null;
  used_count: number;
  min_order_value: number;
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * Reads `merchant_promotions` (apply `docs/supabase/merchant_promotions.sql` to provision).
 * Also exposes mutate helpers (`create`, `updateStatus`, `remove`) that respect RLS.
 */
export function useMerchantPromotions(
  env: AppEnv,
  outletId: string | null,
) {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = getSupabase(env);
    const { data, error: e } = await sb
      .from('merchant_promotions')
      .select(
        'id, title, status, discount_label, max_uses, used_count, min_order_value, starts_at, ends_at',
      )
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false });
    if (e) {
      logSupabaseError(e, 'useMerchantPromotions.load');
      setRows([]);
      setError(mapSupabaseError(e, 'Could not load promotions.'));
    } else {
      const mapped: PromoRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? ''),
        status: (String(r.status ?? 'active') as PromoStatus),
        discount_label: String(r.discount_label ?? ''),
        max_uses: r.max_uses == null ? null : Number(r.max_uses),
        used_count: Number(r.used_count ?? 0),
        min_order_value: Number(r.min_order_value ?? 0),
        starts_at: typeof r.starts_at === 'string' ? (r.starts_at as string) : null,
        ends_at: typeof r.ends_at === 'string' ? (r.ends_at as string) : null,
      }));
      setRows(mapped);
      setError(null);
    }
    setLoading(false);
  }, [env, outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: {
      title: string;
      discount_label: string;
      status: PromoStatus;
      max_uses?: number | null;
      min_order_value?: number;
      starts_at?: string | null;
      ends_at?: string | null;
    }): Promise<{ error?: string }> => {
      if (!outletId) return { error: 'No active outlet' };
      const sb = getSupabase(env);
      const payload: Record<string, unknown> = {
        outlet_id: outletId,
        title: input.title.trim(),
        discount_label: input.discount_label.trim(),
        status: input.status,
      };
      if (input.max_uses != null) payload.max_uses = input.max_uses;
      if (typeof input.min_order_value === 'number') {
        payload.min_order_value = input.min_order_value;
      }
      if (input.starts_at !== undefined) payload.starts_at = input.starts_at;
      if (input.ends_at !== undefined) payload.ends_at = input.ends_at;
      const { error: e } = await sb.from('merchant_promotions').insert(payload);
      if (e) return { error: mapSupabaseError(e) };
      await load();
      return {};
    },
    [env, outletId, load],
  );

  const update = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        discount_label?: string;
        status?: PromoStatus;
        max_uses?: number | null;
        min_order_value?: number;
        starts_at?: string | null;
        ends_at?: string | null;
      },
    ): Promise<{ error?: string }> => {
      const sb = getSupabase(env);
      const payload: Record<string, unknown> = {};
      if (patch.title !== undefined) payload.title = patch.title.trim();
      if (patch.discount_label !== undefined) payload.discount_label = patch.discount_label.trim();
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.max_uses !== undefined) payload.max_uses = patch.max_uses;
      if (patch.min_order_value !== undefined) payload.min_order_value = patch.min_order_value;
      if (patch.starts_at !== undefined) payload.starts_at = patch.starts_at;
      if (patch.ends_at !== undefined) payload.ends_at = patch.ends_at;
      if (Object.keys(payload).length === 0) return {};
      const { error: e } = await sb.from('merchant_promotions').update(payload).eq('id', id);
      if (e) return { error: mapSupabaseError(e) };
      await load();
      return {};
    },
    [env, load],
  );

  const updateStatus = useCallback(
    async (id: string, status: PromoStatus): Promise<{ error?: string }> => {
      const sb = getSupabase(env);
      const { error: e } = await sb
        .from('merchant_promotions')
        .update({ status })
        .eq('id', id);
      if (e) return { error: mapSupabaseError(e) };
      await load();
      return {};
    },
    [env, load],
  );

  const remove = useCallback(
    async (id: string): Promise<{ error?: string }> => {
      const sb = getSupabase(env);
      const { error: e } = await sb
        .from('merchant_promotions')
        .delete()
        .eq('id', id);
      if (e) return { error: mapSupabaseError(e) };
      await load();
      return {};
    },
    [env, load],
  );

  return { rows, loading, error, refetch: load, create, update, updateStatus, remove };
}
