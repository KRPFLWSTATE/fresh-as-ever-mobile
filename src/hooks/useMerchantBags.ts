import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { canPublishRescueBags } from '@/lib/outletListingMode';
import { logError } from '@/observability/logError';
import { mapSupabaseError, logSupabaseError } from '@/lib/supabaseError';

export type MerchantBagRow = {
  id: string;
  title: string;
  rescue_price: number;
  retail_value_estimate: number | null;
  quantity_available: number | null;
  status: string;
  category: string | null;
  image_url: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
};

export type CreateMerchantBagPayload = {
  title: string;
  notes?: string | null;
  category: string;
  estimated_weight_kg: number;
  retail_value_estimate: number;
  rescue_price: number;
  quantity_total: number;
  quantity_remaining: number;
  pickup_start: string;
  pickup_end: string;
  pickup_window_kind?: string;
  occasion_kind?: string;
  image_url?: string | null;
  status: string;
  allergens?: string[] | null;
  is_halal?: boolean | null;
};

function mapBag(b: Record<string, unknown>): MerchantBagRow {
  const rescue = Number(b.rescue_price);
  const retail = Number(b.retail_value_estimate);
  const qtyRem = Number(b.quantity_remaining);
  return {
    id: String(b.id),
    title: String(b.title ?? ''),
    rescue_price: Number.isFinite(rescue) ? rescue : 0,
    retail_value_estimate: Number.isFinite(retail) ? retail : null,
    quantity_available: Number.isFinite(qtyRem) ? qtyRem : null,
    status: String(b.status ?? ''),
    category: typeof b.category === 'string' ? b.category : null,
    image_url:
      typeof b.image_url === 'string' || b.image_url === null ? (b.image_url as string | null) : null,
    pickup_start:
      typeof b.pickup_start === 'string' ? b.pickup_start : null,
    pickup_end: typeof b.pickup_end === 'string' ? b.pickup_end : null,
  };
}

export function useMerchantBags(env: AppEnv) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const { activeOutlet, loading: contextLoading } = useMerchantContext(env);

  const [bags, setBags] = useState<MerchantBagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const outletCategory =
    typeof activeOutlet?.category === 'string' ? activeOutlet.category : '';
  const bagsAllowed = canPublishRescueBags(outletCategory);

  const fetchBags = useCallback(async () => {
    const outletId = activeOutlet?.id != null ? String(activeOutlet.id) : '';
    if (!outletId || !bagsAllowed) {
      setBags([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('rescue_bags')
        .select('*')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setBags(((data ?? []) as Record<string, unknown>[]).map(mapBag));
    } catch (e) {
      logSupabaseError(e, 'useMerchantBags.fetchBags');
      setError(mapSupabaseError(e as Error, 'Could not load bags.'));
      setBags([]);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, bagsAllowed, supabase]);

  useEffect(() => {
    if (contextLoading) {
      return;
    }
    fetchBags().catch((err) => logError(err, { context: 'useMerchantBags.fetchBags' }));
  }, [fetchBags, contextLoading]);

  const deleteBag = useCallback(
    async (id: string): Promise<{ error?: string }> => {
      setBags((prev) => prev.filter((b) => b.id !== id));
      const { error: upErr } = await supabase
        .from('rescue_bags')
        .update({ status: 'removed' })
        .eq('id', id);

      if (upErr) {
        await fetchBags();
        return { error: upErr.message };
      }
      return {};
    },
    [supabase, fetchBags],
  );

  const createBag = useCallback(
    async (payload: CreateMerchantBagPayload) => {
      const outletId = activeOutlet?.id != null ? String(activeOutlet.id) : '';
      if (!outletId) {
        throw new Error('Merchant outlet is not ready yet.');
      }
      if (!bagsAllowed) {
        throw new Error('This outlet publishes clearance shelves only.');
      }

      const { data, error: insErr } = await supabase
        .from('rescue_bags')
        .insert({
          ...payload,
          outlet_id: outletId,
        })
        .select()
        .single();

      if (insErr) {
        throw insErr;
      }
      await fetchBags();
      return data as Record<string, unknown>;
    },
    [activeOutlet?.id, bagsAllowed, supabase, fetchBags],
  );

  const updateBag = useCallback(
    async (bagId: string, patch: Record<string, unknown>) => {
      const { error: upErr } = await supabase
        .from('rescue_bags')
        .update(patch)
        .eq('id', bagId)
        .select()
        .single();

      if (upErr) {
        throw upErr;
      }
      await fetchBags();
    },
    [supabase, fetchBags],
  );

  return {
    bags,
    loading: loading || contextLoading,
    error,
    activeOutlet,
    deleteBag,
    createBag,
    updateBag,
    refetch: fetchBags,
  };
}
