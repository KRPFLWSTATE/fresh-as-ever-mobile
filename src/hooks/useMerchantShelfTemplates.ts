import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppEnv } from '@/config/env';
import { mapSupabaseError } from '@/lib/supabaseError';

export type ShelfTemplateRow = {
  id: string;
  name: string;
  notes: string | null;
  item_count: number;
};

export function useMerchantShelfTemplates(env: AppEnv, outletId: string | null) {
  const supabase = useMemo(() => getSupabase(env), [env]);
  const [templates, setTemplates] = useState<ShelfTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!outletId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from('shelf_templates')
        .select('id, name, notes, items:shelf_template_items(count)')
        .eq('outlet_id', outletId)
        .order('updated_at', { ascending: false });
      if (qErr) throw qErr;
      const rows = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const items = r.items as { count?: number }[] | undefined;
        const count = items?.[0]?.count ?? 0;
        return {
          id: String(r.id),
          name: String(r.name ?? 'Template'),
          notes: typeof r.notes === 'string' ? r.notes : null,
          item_count: Number(count),
        };
      });
      setTemplates(rows);
    } catch (err) {
      setError(mapSupabaseError(err as Error));
    } finally {
      setLoading(false);
    }
  }, [outletId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cloneTemplateToToday = useCallback(
    async (templateId: string) => {
      const { data, error: rpcErr } = await supabase.rpc('clone_template_to_today', {
        p_template_id: templateId,
      });
      if (rpcErr) throw rpcErr;
      await refresh();
      return data as string;
    },
    [refresh, supabase],
  );

  const saveTemplateFromShelf = useCallback(
    async (args: {
      name: string;
      notes?: string | null;
      items: Record<string, unknown>[];
    }) => {
      if (!outletId) throw new Error('No outlet selected');
      const { data: tpl, error: insErr } = await supabase
        .from('shelf_templates')
        .insert({
          outlet_id: outletId,
          name: args.name.trim(),
          notes: args.notes ?? null,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      const templateId = String(tpl.id);
      const payloads = args.items.map((item, idx) => ({
        template_id: templateId,
        product_id: item.product_id ?? null,
        barcode: item.barcode ?? null,
        name_snapshot: String(item.name_snapshot ?? 'Item'),
        brand_snapshot: item.brand_snapshot ?? null,
        image_url_snapshot: item.image_url_snapshot ?? null,
        allergens_snapshot: Array.isArray(item.allergens_snapshot)
          ? item.allergens_snapshot
          : [],
        is_halal: item.is_halal ?? null,
        retail_price: item.retail_price ?? null,
        rescue_price: Number(item.rescue_price ?? 0),
        quantity_total: Number(item.quantity_total ?? 1),
        sort_order: typeof item.sort_order === 'number' ? item.sort_order : idx,
      }));
      if (payloads.length > 0) {
        const { error: itemsErr } = await supabase
          .from('shelf_template_items')
          .insert(payloads);
        if (itemsErr) throw itemsErr;
      }
      await refresh();
      return templateId;
    },
    [outletId, refresh, supabase],
  );

  return {
    templates,
    loading,
    error,
    refresh,
    cloneTemplateToToday,
    saveTemplateFromShelf,
  };
}
